// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ArcLensRegistry
/// @notice Anchors fingerprints of ArcLens reports on Arc mainnet.
/// An anchor records that a report with hash `reportHash`, covering
/// `subject` over blocks [fromBlock, toBlock], existed at the anchoring block.
/// Anyone can recompute the hash from the report's JSON snapshot and compare.
/// No owner, no fees, no funds held: the contract only stores fingerprints.
contract ArcLensRegistry {
    struct Anchor {
        bytes32 reportHash;
        address subject;
        address anchoredBy;
        uint64 fromBlock;
        uint64 toBlock;
        uint64 anchoredAt; // block number of the anchoring transaction
    }

    /// @dev Every anchor ever made, in order.
    Anchor[] private _anchors;
    /// @dev reportHash => index + 1 (0 = not anchored).
    mapping(bytes32 => uint256) private _indexOf;
    /// @dev subject => indexes into _anchors.
    mapping(address => uint256[]) private _bySubject;

    event ReportAnchored(
        address indexed subject,
        address indexed anchoredBy,
        bytes32 indexed reportHash,
        uint64 fromBlock,
        uint64 toBlock,
        uint256 index
    );

    error AlreadyAnchored(bytes32 reportHash);
    error InvalidRange();
    error ZeroHash();

    function anchor(address subject, uint64 fromBlock, uint64 toBlock, bytes32 reportHash) external returns (uint256 index) {
        if (reportHash == bytes32(0)) revert ZeroHash();
        if (fromBlock > toBlock || toBlock > block.number) revert InvalidRange();
        if (_indexOf[reportHash] != 0) revert AlreadyAnchored(reportHash);

        index = _anchors.length;
        _anchors.push(Anchor(reportHash, subject, msg.sender, fromBlock, toBlock, uint64(block.number)));
        _indexOf[reportHash] = index + 1;
        _bySubject[subject].push(index);

        emit ReportAnchored(subject, msg.sender, reportHash, fromBlock, toBlock, index);
    }

    function totalAnchors() external view returns (uint256) {
        return _anchors.length;
    }

    function anchorAt(uint256 index) external view returns (Anchor memory) {
        return _anchors[index];
    }

    /// @notice Look up an anchor by report hash. `found` is false if never anchored.
    function anchorOf(bytes32 reportHash) external view returns (bool found, Anchor memory a) {
        uint256 i = _indexOf[reportHash];
        if (i == 0) return (false, a);
        return (true, _anchors[i - 1]);
    }

    function anchorCountFor(address subject) external view returns (uint256) {
        return _bySubject[subject].length;
    }

    /// @notice Most recent anchors for a subject, newest first (at most `limit`).
    function recentAnchorsFor(address subject, uint256 limit) external view returns (Anchor[] memory out) {
        uint256[] storage ids = _bySubject[subject];
        uint256 n = ids.length < limit ? ids.length : limit;
        out = new Anchor[](n);
        for (uint256 k = 0; k < n; k++) {
            out[k] = _anchors[ids[ids.length - 1 - k]];
        }
    }
}
