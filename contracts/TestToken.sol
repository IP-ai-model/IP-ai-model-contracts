// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TestToken is ERC20, Ownable {
    constructor() ERC20("test token", "tt") {
        _transferOwnership(msg.sender);
        // 初始铸造1000万个代币给部署者
        _mint(msg.sender, 10000000 * 10 ** decimals());
    }

    // 允许所有者铸造更多代币
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    // 为了测试，允许任何人铸造少量代币
    function faucet(uint256 amount) external {
        require(amount <= 1000 * 10 ** decimals(), "Too much requested");
        _mint(msg.sender, amount);
    }
}
