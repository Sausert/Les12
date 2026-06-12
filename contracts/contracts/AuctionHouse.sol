// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/// @title Sonic Omerta Auction House — underground English auctions
/// @notice NFTs are escrowed here for the duration of the auction. Outbid
///         bidders are refunded on the spot; settlement pays the seller and
///         hands the item to the winner (or returns it unsold).
contract AuctionHouse {
    using SafeERC20 for IERC20;

    struct Auction {
        address seller;
        uint256 tokenId;
        uint256 startPrice;
        uint256 highBid;
        address highBidder;
        uint64 endsAt;
        bool settled;
    }

    IERC20 public immutable token;
    IERC721 public immutable items;

    uint256 public nextAuctionId = 1;
    mapping(uint256 auctionId => Auction) public auctions;

    event AuctionCreated(
        uint256 indexed auctionId,
        address indexed seller,
        uint256 indexed tokenId,
        uint256 startPrice,
        uint64 endsAt
    );
    event BidPlaced(uint256 indexed auctionId, address indexed bidder, uint256 amount);
    event AuctionSettled(uint256 indexed auctionId, address indexed winner, uint256 amount);

    error AuctionNotFound();
    error AuctionEnded();
    error AuctionNotEnded();
    error AlreadySettled();
    error BidTooLow();
    error InvalidDuration();

    constructor(IERC20 token_, IERC721 items_) {
        token = token_;
        items = items_;
    }

    function createAuction(
        uint256 tokenId,
        uint256 startPrice,
        uint64 duration
    ) external returns (uint256 auctionId) {
        if (duration == 0 || duration > 30 days) revert InvalidDuration();
        items.transferFrom(msg.sender, address(this), tokenId);
        auctionId = nextAuctionId;
        nextAuctionId += 1;
        auctions[auctionId] = Auction({
            seller: msg.sender,
            tokenId: tokenId,
            startPrice: startPrice,
            highBid: 0,
            highBidder: address(0),
            endsAt: uint64(block.timestamp) + duration,
            settled: false
        });
        emit AuctionCreated(auctionId, msg.sender, tokenId, startPrice, auctions[auctionId].endsAt);
    }

    function bid(uint256 auctionId, uint256 amount) external {
        Auction storage auction = auctions[auctionId];
        if (auction.seller == address(0)) revert AuctionNotFound();
        if (block.timestamp >= auction.endsAt) revert AuctionEnded();
        uint256 minimum = auction.highBidder == address(0)
            ? auction.startPrice
            : auction.highBid + 1;
        if (amount < minimum) revert BidTooLow();

        token.safeTransferFrom(msg.sender, address(this), amount);
        // Refund the previous high bidder on the spot.
        if (auction.highBidder != address(0)) {
            token.safeTransfer(auction.highBidder, auction.highBid);
        }
        auction.highBid = amount;
        auction.highBidder = msg.sender;
        emit BidPlaced(auctionId, msg.sender, amount);
    }

    function settle(uint256 auctionId) external {
        Auction storage auction = auctions[auctionId];
        if (auction.seller == address(0)) revert AuctionNotFound();
        if (block.timestamp < auction.endsAt) revert AuctionNotEnded();
        if (auction.settled) revert AlreadySettled();
        auction.settled = true;

        if (auction.highBidder == address(0)) {
            // No bids: the item walks back to the seller.
            items.transferFrom(address(this), auction.seller, auction.tokenId);
            emit AuctionSettled(auctionId, address(0), 0);
            return;
        }
        items.transferFrom(address(this), auction.highBidder, auction.tokenId);
        token.safeTransfer(auction.seller, auction.highBid);
        emit AuctionSettled(auctionId, auction.highBidder, auction.highBid);
    }
}
