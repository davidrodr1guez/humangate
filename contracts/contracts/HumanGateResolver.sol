// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title HumanGateResolver — ENSIP-10 wildcard resolver for verified agents
/// @notice Resolves human-readable names like mybot.humanbacked.eth → agent address,
///         but ONLY if the agent has passed HumanGate verification.
///         Implements ENSIP-25 verification loop: agent ↔ ENS name bidirectional attestation.

interface IHumanGate {
    function isVerified(address agent) external view returns (bool);
}

contract HumanGateResolver {
    IHumanGate public immutable gate;

    /// @dev labelhash → agent address
    mapping(bytes32 => address) public names;

    /// @dev agent → chosen label (e.g. "mybot")
    mapping(address => string) public labels;

    /// @dev agent → registration timestamp
    mapping(address => uint256) public verifiedAt;

    /// @dev agent → custom text records (key → value)
    mapping(address => mapping(string => string)) private _textRecords;

    event AgentNameRegistered(address indexed agent, string label, string ensName, uint256 timestamp);
    event TextRecordSet(address indexed agent, string key, string value);

    error LabelTaken();
    error EmptyLabel();

    constructor(IHumanGate _gate) {
        gate = _gate;
    }

    /// @notice Register a human-readable ENS name for a verified agent.
    ///         e.g. registerAgent(0x1234..., "mybot") → mybot.humanbacked.eth
    function registerAgent(address agent, string calldata label) external {
        require(gate.isVerified(agent), "Agent not verified");
        if (bytes(label).length == 0) revert EmptyLabel();

        bytes32 labelhash = keccak256(bytes(label));
        if (names[labelhash] != address(0)) revert LabelTaken();

        names[labelhash] = agent;
        labels[agent] = label;
        verifiedAt[agent] = block.timestamp;

        string memory ensName = string.concat(label, ".humanbacked.eth");

        // Default text records — attestation metadata
        _textRecords[agent]["humangate.verified"] = "true";
        _textRecords[agent]["humangate.verifiedAt"] = _uint256ToString(block.timestamp);
        _textRecords[agent]["humangate.contract"] = _addressToHexString(address(gate));
        _textRecords[agent]["humangate.resolver"] = _addressToHexString(address(this));
        _textRecords[agent]["humangate.chain"] = "480";
        _textRecords[agent]["humangate.label"] = label;
        _textRecords[agent]["description"] = string.concat(
            "Human-backed AI agent '", label, "' verified via HumanGate + World ID"
        );

        emit AgentNameRegistered(agent, label, ensName, block.timestamp);
    }

    /// @notice Let a verified agent set additional text records
    function setText(address agent, string calldata key, string calldata value) external {
        require(gate.isVerified(agent), "Agent not verified");
        require(bytes(labels[agent]).length > 0, "Agent not registered");
        _textRecords[agent][key] = value;
        emit TextRecordSet(agent, key, value);
    }

    /// @notice Read a text record for a registered agent
    function text(address agent, string calldata key) external view returns (string memory) {
        require(bytes(labels[agent]).length > 0, "Agent not registered");
        return _textRecords[agent][key];
    }

    /// @notice Get the full ENS name for an agent
    function ensNameOf(address agent) external view returns (string memory) {
        string memory label = labels[agent];
        if (bytes(label).length == 0) return "";
        return string.concat(label, ".humanbacked.eth");
    }

    // ---- ENSIP-10: wildcard resolution ----

    /// @notice Resolves a subname of humanbacked.eth to address or text records.
    function resolve(bytes calldata name, bytes calldata data)
        external
        view
        returns (bytes memory)
    {
        uint8 labelLen = uint8(name[0]);
        bytes32 labelhash = keccak256(name[1:1 + labelLen]);

        address agent = names[labelhash];
        require(agent != address(0), "Name not found");
        require(gate.isVerified(agent), "Agent no longer verified");

        bytes4 selector = bytes4(data[:4]);

        // addr(bytes32) → return the agent address
        if (selector == 0x3b3b57de) {
            return abi.encode(agent);
        }

        // text(bytes32,string) → return text record
        if (selector == 0x59d1d43c) {
            (, string memory key) = abi.decode(data[4:], (bytes32, string));
            return abi.encode(_textRecords[agent][key]);
        }

        revert("Unsupported resolution");
    }

    /// @notice ERC-165: advertise ExtendedResolver + text resolver support
    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return
            interfaceId == 0x9061b923 || // ExtendedResolver
            interfaceId == 0x59d1d43c || // ITextResolver
            interfaceId == 0x01ffc9a7;   // ERC-165
    }

    // ---- internal helpers ----

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

    function _uint256ToString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
