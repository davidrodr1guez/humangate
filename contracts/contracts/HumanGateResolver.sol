// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title HumanGateResolver — ENSIP-10 wildcard resolver for verified agents
/// @notice Resolves {address}.humanbacked.eth → agent address, but ONLY if
///         the agent has passed HumanGate verification. Unverified agents
///         get no ENS identity.

interface IHumanGate {
    function isVerified(address agent) external view returns (bool);
}

contract HumanGateResolver {
    IHumanGate public immutable gate;

    /// @dev labelhash → agent address (set when agent registers after verification)
    mapping(bytes32 => address) public names;

    event AgentNameRegistered(address indexed agent, string ensName);

    constructor(IHumanGate _gate) {
        gate = _gate;
    }

    /// @notice Called after HumanGate verification to assign an ENS identity.
    ///         Only works for agents that have already been verified on-chain.
    function registerAgent(address agent) external {
        require(gate.isVerified(agent), "Agent not verified");
        string memory label = _addressToHexString(agent);
        bytes32 labelhash = keccak256(bytes(label));
        names[labelhash] = agent;
        emit AgentNameRegistered(agent, string.concat(label, ".humanbacked.eth"));
    }

    // ---- ENSIP-10: wildcard resolution ----

    /// @notice Resolves a subname of humanbacked.eth to the verified agent address.
    ///         DNS-encoded name arrives as: [labelLen][label][11]humanbacked[3]eth[0]
    function resolve(bytes calldata name, bytes calldata data)
        external
        view
        returns (bytes memory)
    {
        // Extract first label from DNS-encoded name
        uint8 labelLen = uint8(name[0]);
        bytes32 labelhash = keccak256(name[1:1 + labelLen]);

        address agent = names[labelhash];
        require(agent != address(0), "Name not found");
        require(gate.isVerified(agent), "Agent no longer verified");

        // Decode the inner call selector
        bytes4 selector = bytes4(data[:4]);

        // addr(bytes32) → return the agent address
        if (selector == 0x3b3b57de) {
            return abi.encode(agent);
        }

        revert("Unsupported resolution");
    }

    /// @notice ERC-165: advertise ExtendedResolver support
    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return
            interfaceId == 0x9061b923 || // ExtendedResolver
            interfaceId == 0x01ffc9a7;   // ERC-165
    }

    // ---- internal ----

    function _addressToHexString(address addr) internal pure returns (string memory) {
        bytes16 alphabet = "0123456789abcdef";
        bytes20 value = bytes20(addr);
        bytes memory str = new bytes(42);
        str[0] = "0";
        str[1] = "x";
        for (uint256 i = 0; i < 20; i++) {
            str[2 + i * 2] = alphabet[uint8(value[i]) >> 4];
            str[3 + i * 2] = alphabet[uint8(value[i]) & 0x0f];
        }
        return string(str);
    }
}
