// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title HumanGate — on-chain proof-of-humanity for AI agents
/// @notice Receives a World ID zero-knowledge proof, verifies it via the
///         WorldID Router, and marks the calling agent address as human-backed.

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

    mapping(uint256 => bool)  internal _usedNullifiers;
    mapping(address => bool)  public   verifiedAgents;

    // ---- events / errors ----
    event AgentVerified(address indexed agent, uint256 nullifierHash);

    error AlreadyVerified();

    // ---- constructor ----
    /// @param _worldId  Address of the WorldID Router on this chain
    /// @param _appId    World ID app identifier (e.g. "app_xxxxx")
    /// @param _action   Action string registered in the Developer Portal
    constructor(IWorldID _worldId, string memory _appId, string memory _action) {
        worldId = _worldId;
        externalNullifierHash = abi
            .encodePacked(abi.encodePacked(_appId).hashToField(), _action)
            .hashToField();
    }

    // ---- core ----
    /// @notice Verify a World ID proof and register `agent` as human-backed.
    /// @param agent         Address of the agent being verified
    /// @param root          Merkle root supplied by IDKit
    /// @param nullifierHash Nullifier hash supplied by IDKit
    /// @param proof         ZK proof (8 × uint256) supplied by IDKit
    function verifyAgent(
        address agent,
        uint256 root,
        uint256 nullifierHash,
        uint256[8] calldata proof
    ) external {
        if (_usedNullifiers[nullifierHash]) revert AlreadyVerified();

        // signal = agent address → prevents proof reuse across agents
        worldId.verifyProof(
            root,
            1,  // groupId 1 = Orb credential
            abi.encodePacked(agent).hashToField(),
            nullifierHash,
            externalNullifierHash,
            proof
        );

        _usedNullifiers[nullifierHash] = true;
        verifiedAgents[agent]          = true;

        emit AgentVerified(agent, nullifierHash);
    }

    /// @notice Read-only check
    function isVerified(address agent) external view returns (bool) {
        return verifiedAgents[agent];
    }
}
