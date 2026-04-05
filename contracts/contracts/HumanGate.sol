// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title HumanGate — on-chain registry of human-backed AI agents
/// @notice The open standard for verifying human-backed agents.
///         Supports two verification paths:
///         1. On-chain ZK proof via WorldID Router
///         2. Cloud-verified registration by trusted operator
///
///         Any contract can check: IHumanGate(gate).isVerified(agent)

// ---------- Minimal interface to the World ID Router ----------
interface IWorldID {
    function verifyProof(
        uint256 root,
        uint256 groupId,
        uint256 signalHash,
        uint256 nullifierHash,
        uint256 externalNullifierHash,
        uint256[8] calldata proof
    ) external view;
}

// ---------- Byte → field-element hashing (same as World ID template) ----------
library ByteHasher {
    function hashToField(bytes memory value) internal pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(value))) >> 8;
    }
}

contract HumanGate {
    using ByteHasher for bytes;

    // ---- state ----
    IWorldID public immutable worldId;
    uint256  public immutable externalNullifierHash;
    address  public immutable operator;

    mapping(uint256 => bool)  internal _usedNullifiers;
    mapping(address => bool)  public   verifiedAgents;

    // ---- events / errors ----
    event AgentVerified(address indexed agent, uint256 nullifierHash);

    error AlreadyVerified();
    error NotOperator();

    // ---- constructor ----
    /// @param _worldId  Address of the WorldID Router on this chain
    /// @param _appId    World ID app identifier (e.g. "app_xxxxx")
    /// @param _action   Action string registered in the Developer Portal
    constructor(IWorldID _worldId, string memory _appId, string memory _action) {
        worldId = _worldId;
        operator = msg.sender;
        externalNullifierHash = abi
            .encodePacked(abi.encodePacked(_appId).hashToField(), _action)
            .hashToField();
    }

    // ---- path 1: on-chain ZK verification ----
    /// @notice Verify a World ID proof and register `agent` as human-backed.
    function verifyAgent(
        address agent,
        uint256 root,
        uint256 nullifierHash,
        uint256[8] calldata proof
    ) external {
        if (_usedNullifiers[nullifierHash]) revert AlreadyVerified();

        worldId.verifyProof(
            root,
            1,
            abi.encodePacked(agent).hashToField(),
            nullifierHash,
            externalNullifierHash,
            proof
        );

        _usedNullifiers[nullifierHash] = true;
        verifiedAgents[agent] = true;

        emit AgentVerified(agent, nullifierHash);
    }

    // ---- path 2: cloud-verified registration ----
    /// @notice Register an agent after cloud verification of the World ID proof.
    ///         Only callable by the trusted operator (backend).
    function registerVerified(address agent, uint256 nullifierHash) external {
        if (msg.sender != operator) revert NotOperator();
        if (_usedNullifiers[nullifierHash]) revert AlreadyVerified();

        _usedNullifiers[nullifierHash] = true;
        verifiedAgents[agent] = true;

        emit AgentVerified(agent, nullifierHash);
    }

    // ---- operator: reset nullifier ----
    /// @notice Allow operator to clear a used nullifier (for testing / re-verification).
    function resetNullifier(uint256 nullifierHash) external {
        if (msg.sender != operator) revert NotOperator();
        _usedNullifiers[nullifierHash] = false;
    }

    /// @notice Allow operator to unverify an agent and clear its nullifier in one call.
    function resetAgent(address agent, uint256 nullifierHash) external {
        if (msg.sender != operator) revert NotOperator();
        _usedNullifiers[nullifierHash] = false;
        verifiedAgents[agent] = false;
    }

    /// @notice Read-only check — the standard interface
    function isVerified(address agent) external view returns (bool) {
        return verifiedAgents[agent];
    }
}
