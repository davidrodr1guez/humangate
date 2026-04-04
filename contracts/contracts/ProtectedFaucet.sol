// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ProtectedFaucet — Example service protected by HumanGate
/// @notice Only human-backed agents can claim tokens. Shows the standard
///         in action: one import, one require, one line.

interface IHumanGate {
    function isVerified(address agent) external view returns (bool);
}

contract ProtectedFaucet {
    IHumanGate public immutable gate;
    uint256 public constant CLAIM_AMOUNT = 0.001 ether;
    mapping(address => bool) public hasClaimed;

    event Claimed(address indexed agent, uint256 amount);

    constructor(IHumanGate _gate) {
        gate = _gate;
    }

    /// @notice Claim tokens — only human-backed agents allowed
    function claim() external {
        require(gate.isVerified(msg.sender), "Not human-backed");
        require(!hasClaimed[msg.sender], "Already claimed");

        hasClaimed[msg.sender] = true;
        payable(msg.sender).transfer(CLAIM_AMOUNT);

        emit Claimed(msg.sender, CLAIM_AMOUNT);
    }

    /// @notice Fund the faucet
    receive() external payable {}
}
