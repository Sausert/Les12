// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title Sonic Omerta Testament — on-chain inheritance
/// @notice When a made man retires for good, the game server attests his
///         death (EIP-712). The heir inherits HEIR_PCT of the deceased's
///         on-chain OMD; the rest burns with him. Requires the deceased to
///         have approved this contract beforehand.
contract Testament is EIP712 {
    using SafeERC20 for IERC20;

    bytes32 private constant DEATH_ATTEST_TYPEHASH =
        keccak256("DeathAttest(address deceased,address heir,uint256 nonce)");

    uint256 public constant HEIR_PCT = 60;

    ERC20Burnable public immutable token;
    address public immutable attestor;

    mapping(address deceased => address) public heirs;
    mapping(uint256 nonce => bool) public usedNonces;

    event HeirNamed(address indexed owner, address indexed heir);
    event TestamentExecuted(
        address indexed deceased,
        address indexed heir,
        uint256 inherited,
        uint256 burned
    );

    error NoHeir();
    error HeirMismatch();
    error NonceUsed();
    error InvalidAttestation();
    error NothingToInherit();

    constructor(ERC20Burnable token_, address attestor_) EIP712("SonicOmertaTestament", "1") {
        token = token_;
        attestor = attestor_;
    }

    function nameHeir(address heir) external {
        heirs[msg.sender] = heir;
        emit HeirNamed(msg.sender, heir);
    }

    /// @notice Executes the will of `deceased`, authorized by an attestor-signed
    ///         EIP-712 DeathAttest. Callable by anyone.
    function execute(address deceased, address heir, uint256 nonce, bytes calldata signature) external {
        if (usedNonces[nonce]) revert NonceUsed();
        address namedHeir = heirs[deceased];
        if (namedHeir == address(0)) revert NoHeir();
        if (namedHeir != heir) revert HeirMismatch();

        bytes32 digest = _hashTypedDataV4(
            keccak256(abi.encode(DEATH_ATTEST_TYPEHASH, deceased, heir, nonce))
        );
        if (ECDSA.recover(digest, signature) != attestor) revert InvalidAttestation();

        uint256 balance = token.balanceOf(deceased);
        if (balance == 0) revert NothingToInherit();

        usedNonces[nonce] = true;
        delete heirs[deceased];

        uint256 inherited = (balance * HEIR_PCT) / 100;
        uint256 burned = balance - inherited;
        IERC20(address(token)).safeTransferFrom(deceased, heir, inherited);
        token.burnFrom(deceased, burned);
        emit TestamentExecuted(deceased, heir, inherited, burned);
    }
}
