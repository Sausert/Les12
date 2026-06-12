// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title Sonic Omerta Bounty — on-chain blood money escrow
/// @notice Anyone can fund a bounty pot on a target address. The pot is paid
///         out to the killer once the game server (attestor) signs an EIP-712
///         kill attestation. No refunds: omertà.
contract Bounty is EIP712 {
    using SafeERC20 for IERC20;

    bytes32 private constant KILL_ATTEST_TYPEHASH =
        keccak256("KillAttest(address target,address killer,uint256 nonce)");

    IERC20 public immutable token;
    address public immutable attestor;

    mapping(address target => uint256) public pots;
    mapping(uint256 nonce => bool) public usedNonces;

    event Funded(address indexed funder, address indexed target, uint256 amount);
    event Claimed(address indexed target, address indexed killer, uint256 amount);

    error ZeroAmount();
    error EmptyPot();
    error NonceUsed();
    error InvalidAttestation();

    constructor(IERC20 token_, address attestor_) EIP712("SonicOmertaBounty", "1") {
        token = token_;
        attestor = attestor_;
    }

    /// @notice Locks `amount` OMD (requires prior approve) on `target`'s head.
    function fund(address target, uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        token.safeTransferFrom(msg.sender, address(this), amount);
        pots[target] += amount;
        emit Funded(msg.sender, target, amount);
    }

    /// @notice Pays the full pot on `target` to `killer`, authorized by an
    ///         attestor-signed EIP-712 KillAttest. Callable by anyone.
    function claim(address target, address killer, uint256 nonce, bytes calldata signature) external {
        if (usedNonces[nonce]) revert NonceUsed();
        uint256 amount = pots[target];
        if (amount == 0) revert EmptyPot();

        bytes32 digest = _hashTypedDataV4(
            keccak256(abi.encode(KILL_ATTEST_TYPEHASH, target, killer, nonce))
        );
        if (ECDSA.recover(digest, signature) != attestor) revert InvalidAttestation();

        usedNonces[nonce] = true;
        pots[target] = 0;
        token.safeTransfer(killer, amount);
        emit Claimed(target, killer, amount);
    }
}
