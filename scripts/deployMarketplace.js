// SPDX-License-Identifier: MIT
const { ethers } = require("hardhat");

async function main() {
    const [deployer, user1, user2] = await ethers.getSigners();
    
    console.log("Deploying contracts with the account:", deployer.address);
    console.log("Account balance:", (await deployer.getBalance()).toString());

    // 部署测试ERC20代币
    console.log("\n=== 部署测试ERC20代币 ===");
    const TestToken = await ethers.getContractFactory("TestToken");
    const testToken = await TestToken.deploy("Test USDT", "TUSDT");
    await testToken.deployed();
    console.log("TestToken (TUSDT) deployed to:", testToken.address);

    // 部署IPModle合约
    console.log("\n=== 部署IPModle合约 ===");
    const IPModle = await ethers.getContractFactory("IPModle");
    const ipModle = await IPModle.deploy("IPModle NFT Collection");
    await ipModle.deployed();
    console.log("IPModle deployed to:", ipModle.address);

    // 部署简化的市场合约
    console.log("\n=== 部署IPModleMarketplace合约 ===");
    const IPModleMarketplace = await ethers.getContractFactory("IPModleMarketplace");
    const marketplace = await IPModleMarketplace.deploy(ipModle.address, deployer.address); // 设置deployer为收款地址
    await marketplace.deployed();
    console.log("IPModleMarketplace deployed to:", marketplace.address);
    console.log("Recipient address set to:", deployer.address);

    // 设置基础URI
    console.log("\n=== 设置基础URI ===");
    await ipModle.setBaseURI("https://api.ipmodle.com/metadata");
    console.log("Base URI set to: https://api.ipmodle.com/metadata");

    // 授权市场合约为铸造者
    console.log("\n=== 授权市场合约 ===");
    await ipModle.setAuthorizedMinter(marketplace.address, true);
    console.log("Marketplace authorized as minter");

    // 创建代币组
    console.log("\n=== 创建代币组 ===");
    
    // 创建稀有卡片组
    const tx1 = await ipModle.createGroup(
        "Rare Cards", 
        "Limited edition rare collectible cards", 
        1000 // 最大供应量1000
    );
    await tx1.wait();
    console.log("Created group 1: Rare Cards (max supply: 1000)");

    // 创建普通道具组
    const tx2 = await ipModle.createGroup(
        "Common Items", 
        "Common game items with unlimited supply", 
        0 // 无限供应
    );
    await tx2.wait();
    console.log("Created group 2: Common Items (unlimited supply)");

    // 创建特殊徽章组
    const tx3 = await ipModle.createGroup(
        "Special Badges", 
        "Achievement badges for special events", 
        500 // 最大供应量500
    );
    await tx3.wait();
    console.log("Created group 3: Special Badges (max supply: 500)");

    // 设置代币组价格和支付代币
    console.log("\n=== 设置代币组价格和支付代币 ===");
    
    // 设置稀有卡片价格: 100 TUSDT (假设TUSDT有6位小数)
    await marketplace.setGroupPriceAndToken(1, ethers.utils.parseUnits("100", 6), testToken.address);
    console.log("Group 1 (Rare Cards): 100 TUSDT each");

    // 设置普通道具价格: 10 TUSDT
    await marketplace.setGroupPriceAndToken(2, ethers.utils.parseUnits("10", 6), testToken.address);
    console.log("Group 2 (Common Items): 10 TUSDT each");

    // 设置特殊徽章价格: 50 TUSDT
    await marketplace.setGroupPriceAndToken(3, ethers.utils.parseUnits("50", 6), testToken.address);
    console.log("Group 3 (Special Badges): 50 TUSDT each");

    // 给用户分发测试代币
    console.log("\n=== 分发测试代币 ===");
    
    // 给user1转1000 TUSDT
    await testToken.transfer(user1.address, ethers.utils.parseUnits("1000", 6));
    console.log("Transferred 1000 TUSDT to user1");
    
    // 给user2转500 TUSDT
    await testToken.transfer(user2.address, ethers.utils.parseUnits("500", 6));
    console.log("Transferred 500 TUSDT to user2");

    // 演示购买流程
    console.log("\n=== 演示购买流程 ===");
    
    // User1授权市场合约使用其TUSDT
    await testToken.connect(user1).approve(marketplace.address, ethers.utils.parseUnits("1000", 6));
    console.log("User1 approved marketplace to spend TUSDT");

    // User1购买3个稀有卡片 (3 * 100 = 300 TUSDT)
    console.log("User1 purchasing 3 Rare Cards...");
    await marketplace.connect(user1).buyTokens(1, 3);
    
    const user1Balance = await ipModle.balanceOf(user1.address, 1);
    const user1TokenBalance = await testToken.balanceOf(user1.address);
    console.log(`User1 now owns ${user1Balance} Rare Cards`);
    console.log(`User1 TUSDT balance: ${ethers.utils.formatUnits(user1TokenBalance, 6)}`);

    // User2授权并购买普通道具
    await testToken.connect(user2).approve(marketplace.address, ethers.utils.parseUnits("500", 6));
    console.log("User2 approved marketplace to spend TUSDT");

    // User2购买20个普通道具 (20 * 10 = 200 TUSDT)
    console.log("User2 purchasing 20 Common Items...");
    await marketplace.connect(user2).buyTokens(2, 20);
    
    const user2Balance = await ipModle.balanceOf(user2.address, 2);
    const user2TokenBalance = await testToken.balanceOf(user2.address);
    console.log(`User2 now owns ${user2Balance} Common Items`);
    console.log(`User2 TUSDT balance: ${ethers.utils.formatUnits(user2TokenBalance, 6)}`);

    // 检查收款地址TUSDT余额（应该是deployer地址）
    const recipientTokenBalance = await testToken.balanceOf(deployer.address);
    console.log(`\nRecipient (deployer) TUSDT balance: ${ethers.utils.formatUnits(recipientTokenBalance, 6)}`);
    
    // 检查市场合约TUSDT余额（应该为0，因为直接转给收款地址）
    const marketplaceTokenBalance = await testToken.balanceOf(marketplace.address);
    console.log(`Marketplace TUSDT balance: ${ethers.utils.formatUnits(marketplaceTokenBalance, 6)}`);

    // 显示合约地址摘要
    console.log("\n=== 部署摘要 ===");
    console.log("TestToken Contract:", testToken.address);
    console.log("IPModle Contract:", ipModle.address);
    console.log("Marketplace Contract:", marketplace.address);
    console.log("Deployer/Recipient:", deployer.address);
    console.log("User1:", user1.address);
    console.log("User2:", user2.address);

    // 显示代币组信息和价格
    console.log("\n=== 代币组信息 ===");
    for (let i = 1; i <= 3; i++) {
        const groupInfo = await marketplace.getGroupDetails(i);
        console.log(`Group ${i}: ${groupInfo.name}`);
        console.log(`  Supply: ${groupInfo.currentSupply}/${groupInfo.maxSupply || 'Unlimited'}`);
        console.log(`  Price: ${ethers.utils.formatUnits(groupInfo.price, 6)} TUSDT`);
        console.log(`  Active: ${groupInfo.isActive}`);
        console.log(`  Pay Token: ${groupInfo.payToken}`);
    }

    console.log("\n=== 使用方法 ===");
    console.log("1. 设置价格: marketplace.setGroupPriceAndToken(groupId, price, tokenAddress)");
    console.log("2. 用户授权: testToken.approve(marketplace.address, amount)");
    console.log("3. 购买代币: marketplace.buyTokens(groupId, amount)");
    console.log("4. 设置收款地址: marketplace.setRecipient(newRecipient)");
    console.log("5. 收益直接转入收款地址，无需手动提取");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
