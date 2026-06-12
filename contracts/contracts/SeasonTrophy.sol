// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title Sonic Omerta Season Trophy — soulbound proof of a season's standing
/// @notice Minted to the top players when a season closes. Non-transferable:
///         reputation is earned, never bought.
contract SeasonTrophy is ERC721, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    struct Standing {
        uint32 season;
        uint8 position;
    }

    uint256 public nextTokenId = 1;
    mapping(uint256 tokenId => Standing) public standings;

    event TrophyMinted(address indexed to, uint256 indexed tokenId, uint32 season, uint8 position);

    error Soulbound();

    constructor(address admin, address minter) ERC721("Omerta Season Trophy", "OMT") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, minter);
    }

    function mintTrophy(
        address to,
        uint32 season,
        uint8 position
    ) external onlyRole(MINTER_ROLE) returns (uint256 tokenId) {
        tokenId = nextTokenId;
        nextTokenId += 1;
        _safeMint(to, tokenId);
        standings[tokenId] = Standing({season: season, position: position});
        emit TrophyMinted(to, tokenId, season, position);
    }

    /// @dev Soulbound: only minting (from == 0) is allowed, never a transfer.
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0)) revert Soulbound();
        return super._update(to, tokenId, auth);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
