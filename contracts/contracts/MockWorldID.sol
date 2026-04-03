// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @dev Mock that accepts any proof — used only in tests.
contract MockWorldID {
    function verifyProof(
        uint256,
        uint256,
        uint256,
        uint256,
        uint256,
        uint256[8] calldata
    ) external pure {
        // no-op: always passes
    }
}
