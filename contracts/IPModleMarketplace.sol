// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IIPModel.sol";

contract IPModelMarketplace is Ownable, ReentrancyGuard {
    
    // IPModel合约实例
    IIPModel public immutable ipModelContract;
    
    // 收款地址
    address public recipient;
    
    // 事件
    event TokensPurchased(address indexed buyer, uint256 indexed groupId, uint256 amount, uint256 totalPrice);
    event RecipientChanged(address indexed oldRecipient, address indexed newRecipient);
    
    constructor(address _ipModelContract, address _recipient) {
        require(_ipModelContract != address(0), "Marketplace: Invalid contract address");
        require(_recipient != address(0), "Marketplace: Invalid recipient address");
        ipModelContract = IIPModel(_ipModelContract);
        recipient = _recipient;
        _transferOwnership(msg.sender);
    }
    
    // 设置收款地址
    function setRecipient(address _recipient) external onlyOwner {
        require(_recipient != address(0), "Marketplace: Invalid recipient address");
        address oldRecipient = recipient;
        recipient = _recipient;
        emit RecipientChanged(oldRecipient, _recipient);
    }
    
    // 购买代币（使用ERC20支付）
    function buyTokens(uint256 groupId, uint256 amount) external nonReentrant {
        require(groupId > 0, "Marketplace: Invalid group ID");
        require(amount > 0, "Marketplace: Amount must be greater than 0");
        
        // 获取组信息
        (, , uint256 maxSupply, uint256 currentSupply, bool isActive, uint256 price, address payToken) = ipModelContract.getGroupInfo(groupId);
        require(isActive, "Marketplace: Group sale not active");
        require(price > 0, "Marketplace: Price not set");
        require(payToken != address(0), "Marketplace: Payment token not set");
        
        // 检查供应量限制
        if (maxSupply > 0) {
            require(currentSupply + amount <= maxSupply, "Marketplace: Exceeds max supply");
        }
        
        uint256 totalPrice = price * amount;
        
        // 直接从用户转移ERC20代币到收款地址
        IERC20(payToken).transferFrom(msg.sender, recipient, totalPrice);
        
        // 直接调用IPModel的mint函数
        ipModelContract.mint(msg.sender, groupId, amount);
        
        emit TokensPurchased(msg.sender, groupId, amount, totalPrice);
    }
    
    // 查询组信息（从IPModel合约获取）
    function getGroupDetails(uint256 groupId) external view returns (
        string memory name,
        string memory description,
        uint256 maxSupply,
        uint256 currentSupply,
        bool isActive,
        uint256 price,
        address payToken
    ) {
        return ipModelContract.getGroupInfo(groupId);
    }
}
