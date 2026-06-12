// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title Sonic Omerta Items — player possessions as tradeable NFTs
/// @notice Weapons, cars and real estate. The game server mints on purchase;
///         the in-game effect of each item type lives in the game's registry.
contract OmertaItems is ERC721URIStorage, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    uint256 public nextTokenId = 1;
    mapping(uint256 tokenId => uint256) public itemTypeOf;

    event ItemMinted(address indexed to, uint256 indexed tokenId, uint256 indexed itemTypeId);

    constructor(address admin, address minter) ERC721("Omerta Items", "OMI") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, minter);
    }

    function mintItem(
        address to,
        uint256 itemTypeId,
        string calldata uri
    ) external onlyRole(MINTER_ROLE) returns (uint256 tokenId) {
        tokenId = nextTokenId;
        nextTokenId += 1;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        itemTypeOf[tokenId] = itemTypeId;
        emit ItemMinted(to, tokenId, itemTypeId);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721URIStorage, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
