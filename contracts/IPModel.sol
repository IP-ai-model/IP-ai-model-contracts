// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract IPModel is ERC1155, Ownable {
    using Strings for uint256;

    // 代币计数器
    uint256 private _nextTokenId;

    // 所有组的ID列表
    uint256[] public groupIds;

    // 基础URI
    string public baseURI;

    // 代币组信息
    struct TokenGroup {
        uint256 id; // 组ID
        string name; // 组名
        string description; // 组描述
        uint256 maxSupply; // 最大供应量 (0表示无限)
        uint256 currentSupply; // 当前供应量
        bool isActive; // 是否激活
        uint256 price; // 单价（ERC20最小单位）
        address payToken; // 支付币种（ERC20地址）
    }

    // 代币ID到组的映射
    mapping(uint256 => TokenGroup) public tokenGroups;

    // 授权地址映射
    mapping(address => bool) public authorizedMinters;

    // 事件
    event GroupCreated(uint256 indexed groupId, string name, uint256 maxSupply);
    event TokensMinted(uint256 indexed groupId, address indexed to, uint256 amount);
    event MinterAuthorized(address indexed minter, bool authorized);

    constructor() ERC1155("IPModel") {
        _nextTokenId = 1;
        baseURI = "";
        _transferOwnership(msg.sender);
    }

    // 设置基础URI
    function setBaseURI(string memory _baseURI) external onlyOwner {
        baseURI = _baseURI;
    }

    // 创建新的代币组
    function createGroup(string memory name, string memory description, uint256 maxSupply) external onlyOwner returns (uint256) {
        uint256 groupId = _nextTokenId;
        _nextTokenId++;

        tokenGroups[groupId] = TokenGroup({ id: groupId, name: name, description: description, maxSupply: maxSupply, currentSupply: 0, isActive: true, price: 0, payToken: address(0) });

        groupIds.push(groupId);

        emit GroupCreated(groupId, name, maxSupply);
        return groupId;
    }

    // 设置组状态
    function setGroupActive(uint256 groupId, bool active) external onlyOwner {
        require(tokenGroups[groupId].maxSupply > 0 || tokenGroups[groupId].currentSupply > 0, "IPModel: Group does not exist");
        tokenGroups[groupId].isActive = active;
    }

    // 设置组价格和支付币种
    function setGroupPriceAndToken(uint256 groupId, uint256 price, address payToken) external onlyOwner {
        require(tokenGroups[groupId].id != 0, "Group not exist");
        tokenGroups[groupId].price = price;
        tokenGroups[groupId].payToken = payToken;
    }

    // 铸造代币到指定组
    function mint(address to, uint256 groupId, uint256 amount) external onlyAuthorizedMinter {
        require(tokenGroups[groupId].isActive, "IPModel: Group is not active");
        require(amount > 0, "IPModel: Amount must be greater than 0");

        // 检查最大供应量限制
        if (tokenGroups[groupId].maxSupply > 0) {
            require(tokenGroups[groupId].currentSupply + amount <= tokenGroups[groupId].maxSupply, "IPModel: Exceeds maximum supply");
        }

        tokenGroups[groupId].currentSupply += amount;
        _mint(to, groupId, amount, "");

        emit TokensMinted(groupId, to, amount);
    }

    // 使用ERC20支付的mint
    function mintWithToken(uint256 groupId, uint256 amount) external {
        TokenGroup storage group = tokenGroups[groupId];
        require(group.isActive, "Group not active");
        require(amount > 0, "Amount must be greater than 0");
        if (group.maxSupply > 0) {
            require(group.currentSupply + amount <= group.maxSupply, "Exceeds max supply");
        }
        require(group.price > 0, "Group price not set");
        require(group.payToken != address(0), "Pay token not set");
        uint256 total = group.price * amount;
        // 收取ERC20
        require(IERC20(group.payToken).transferFrom(msg.sender, address(this), total), "ERC20 payment failed");
        group.currentSupply += amount;
        _mint(msg.sender, groupId, amount, "");
    }

    // 获取代币URI (ERC1155标准)
    function uri(uint256 _tokenId) public view virtual override returns (string memory) {
        require(tokenGroups[_tokenId].isActive || tokenGroups[_tokenId].currentSupply > 0, "IPModel: Token group does not exist");

        if (bytes(baseURI).length == 0) {
            return "";
        }
        uint256 groupId = tokenGroups[_tokenId].id;

        return string(abi.encodePacked(baseURI, "/", Strings.toString(groupId), "/", Strings.toString(_tokenId)));
    }

    // 获取所有组的数量
    function getGroupCount() external view returns (uint256) {
        return groupIds.length;
    }

    // 获取组信息
    function getGroupInfo(uint256 groupId) external view returns (
        string memory name,
        string memory description, 
        uint256 maxSupply,
        uint256 currentSupply,
        bool isActive,
        uint256 price,
        address payToken
    ) {
        TokenGroup memory group = tokenGroups[groupId];
        return (group.name, group.description, group.maxSupply, group.currentSupply, group.isActive, group.price, group.payToken);
    }

    // 授权/取消授权铸造者
    function setAuthorizedMinter(address minter, bool authorized) external onlyOwner {
        require(minter != address(0), "IPModel: Invalid minter address");
        authorizedMinters[minter] = authorized;
        emit MinterAuthorized(minter, authorized);
    }

    // 检查是否支持某个接口
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    // 修饰符：检查是否为授权的铸造者
    modifier onlyAuthorizedMinter() {
        require(owner() == msg.sender || authorizedMinters[msg.sender], "IPModel: Not authorized to mint");
        _;
    }
}
