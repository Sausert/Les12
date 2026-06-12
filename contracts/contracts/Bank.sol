// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

/// @title Sonic Omerta Bank — canonical deposit sink
/// @notice Players (or the server signing on their behalf) deposit OMD back into
///         the game by burning it here. The game server watches Deposited events
///         (or the tx receipt) and credits the off-chain balance.
contract Bank {
    ERC20Burnable public immutable token;

    event Deposited(address indexed player, uint256 amount);

    error ZeroAmount();

    constructor(ERC20Burnable token_) {
        token = token_;
    }

    /// @notice Burns `amount` OMD from the caller (requires prior approve) and
    ///         emits the deposit event the game server credits from.
    function deposit(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        token.burnFrom(msg.sender, amount);
        emit Deposited(msg.sender, amount);
    }
}
