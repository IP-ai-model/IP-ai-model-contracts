// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IIPModel {
    // 获取组信息
    function getGroupInfo(uint256 groupId) external view returns (
        string memory name,
        string memory description, 
        uint256 maxSupply,
        uint256 currentSupply,
        bool isActive,
        uint256 price,
        address payToken
    );
    
    // 铸造代币
    function mint(address to, uint256 groupId, uint256 amount) external;
}
