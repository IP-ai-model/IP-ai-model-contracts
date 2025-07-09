const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("IPModelMarketplace", function () {
    let IPModel, ipModel, IPModelMarketplace, marketplace, TestToken, testToken;
    let owner, addr1, addr2, addr3, recipient;

    beforeEach(async function () {
        [owner, addr1, addr2, addr3, recipient] = await ethers.getSigners();

        // 部署TestToken合约
        TestToken = await ethers.getContractFactory("TestToken");
        testToken = await TestToken.deploy();
        await testToken.waitForDeployment();

        // 部署IPModel合约
        IPModel = await ethers.getContractFactory("IPModel");
        ipModel = await IPModel.deploy();
        await ipModel.waitForDeployment();

        // 部署IPModelMarketplace合约
        IPModelMarketplace = await ethers.getContractFactory("IPModelMarketplace");
        marketplace = await IPModelMarketplace.deploy(
            await ipModel.getAddress(),
            recipient.address
        );
        await marketplace.waitForDeployment();

        // 设置marketplace为IPModel的授权铸造者
        await ipModel.setAuthorizedMinter(await marketplace.getAddress(), true);

        // 为测试用户铸造一些测试代币
        await testToken.connect(addr1).faucet(ethers.parseEther("1000"));
        await testToken.connect(addr2).faucet(ethers.parseEther("1000"));
    });

    describe("Deployment", function () {
        it("Should set the right owner", async function () {
            expect(await marketplace.owner()).to.equal(owner.address);
        });

        it("Should set the correct IPModel contract", async function () {
            expect(await marketplace.ipModelContract()).to.equal(await ipModel.getAddress());
        });

        it("Should set the correct recipient", async function () {
            expect(await marketplace.recipient()).to.equal(recipient.address);
        });

        it("Should revert with invalid contract address", async function () {
            await expect(IPModelMarketplace.deploy(ethers.ZeroAddress, recipient.address))
                .to.be.revertedWith("Marketplace: Invalid contract address");
        });

        it("Should revert with invalid recipient address", async function () {
            await expect(IPModelMarketplace.deploy(await ipModel.getAddress(), ethers.ZeroAddress))
                .to.be.revertedWith("Marketplace: Invalid recipient address");
        });
    });

    describe("Recipient Management", function () {
        it("Should allow owner to change recipient", async function () {
            await expect(marketplace.setRecipient(addr3.address))
                .to.emit(marketplace, "RecipientChanged")
                .withArgs(recipient.address, addr3.address);

            expect(await marketplace.recipient()).to.equal(addr3.address);
        });

        it("Should not allow non-owner to change recipient", async function () {
            await expect(marketplace.connect(addr1).setRecipient(addr3.address))
                .to.be.reverted;
        });

        it("Should revert when setting zero address as recipient", async function () {
            await expect(marketplace.setRecipient(ethers.ZeroAddress))
                .to.be.revertedWith("Marketplace: Invalid recipient address");
        });
    });

    describe("Group Management", function () {
        it("Should get group details correctly", async function () {
            await ipModel.createGroup("Test Model", "Test Description", 1000);
            await ipModel.setGroupPriceAndToken(1, ethers.parseEther("10"), await testToken.getAddress());

            const groupDetails = await marketplace.getGroupDetails(1);
            expect(groupDetails[0]).to.equal("Test Model"); // name
            expect(groupDetails[1]).to.equal("Test Description"); // description
            expect(groupDetails[2]).to.equal(1000); // maxSupply
            expect(groupDetails[3]).to.equal(0); // currentSupply
            expect(groupDetails[4]).to.equal(true); // isActive
            expect(groupDetails[5]).to.equal(ethers.parseEther("10")); // price
            expect(groupDetails[6]).to.equal(await testToken.getAddress()); // payToken
        });
    });

    describe("Token Purchase", function () {
        beforeEach(async function () {
            // 创建测试组
            await ipModel.createGroup("Premium Model", "Premium AI Model", 1000);
            await ipModel.setGroupPriceAndToken(1, ethers.parseEther("50"), await testToken.getAddress());
        });

        it("Should allow users to buy tokens", async function () {
            const amount = 2;
            const totalPrice = ethers.parseEther("100"); // 2 * 50

            // 用户授权marketplace使用其代币
            await testToken.connect(addr1).approve(await marketplace.getAddress(), totalPrice);

            const recipientBalanceBefore = await testToken.balanceOf(recipient.address);
            const userBalanceBefore = await testToken.balanceOf(addr1.address);

            await expect(marketplace.connect(addr1).buyTokens(1, amount))
                .to.emit(marketplace, "TokensPurchased")
                .withArgs(addr1.address, 1, amount, totalPrice);

            // 验证用户收到了NFT
            expect(await ipModel.balanceOf(addr1.address, 1)).to.equal(amount);

            // 验证收款地址收到了代币
            const recipientBalanceAfter = await testToken.balanceOf(recipient.address);
            const userBalanceAfter = await testToken.balanceOf(addr1.address);

            expect(recipientBalanceAfter - recipientBalanceBefore).to.equal(totalPrice);
            expect(userBalanceBefore - userBalanceAfter).to.equal(totalPrice);

            // 验证供应量更新
            const groupInfo = await marketplace.getGroupDetails(1);
            expect(groupInfo[3]).to.equal(amount); // currentSupply
        });

        it("Should revert with invalid group ID", async function () {
            await expect(marketplace.connect(addr1).buyTokens(0, 1))
                .to.be.revertedWith("Marketplace: Invalid group ID");
        });

        it("Should revert with zero amount", async function () {
            await expect(marketplace.connect(addr1).buyTokens(1, 0))
                .to.be.revertedWith("Marketplace: Amount must be greater than 0");
        });

        it("Should revert when group is not active", async function () {
            await ipModel.setGroupActive(1, false);

            await expect(marketplace.connect(addr1).buyTokens(1, 1))
                .to.be.revertedWith("Marketplace: Group sale not active");
        });

        it("Should revert when price is not set", async function () {
            await ipModel.createGroup("Free Model", "Free Description", 1000);
            // 不设置价格

            await expect(marketplace.connect(addr1).buyTokens(2, 1))
                .to.be.revertedWith("Marketplace: Price not set");
        });

        it("Should revert when payment token is not set", async function () {
            await ipModel.createGroup("No Token Model", "No Token Description", 1000);
            await ipModel.setGroupPriceAndToken(2, ethers.parseEther("10"), ethers.ZeroAddress);

            await expect(marketplace.connect(addr1).buyTokens(2, 1))
                .to.be.revertedWith("Marketplace: Payment token not set");
        });

        it("Should revert when exceeding max supply", async function () {
            // 创建一个只有5个最大供应量的组
            await ipModel.createGroup("Limited Model", "Limited Description", 5);
            await ipModel.setGroupPriceAndToken(2, ethers.parseEther("10"), await testToken.getAddress());

            const totalPrice = ethers.parseEther("60"); // 6 * 10
            await testToken.connect(addr1).approve(await marketplace.getAddress(), totalPrice);

            await expect(marketplace.connect(addr1).buyTokens(2, 6))
                .to.be.revertedWith("Marketplace: Exceeds max supply");
        });

        it("Should handle unlimited supply correctly", async function () {
            await ipModel.createGroup("Unlimited Model", "Unlimited Description", 0);
            await ipModel.setGroupPriceAndToken(2, ethers.parseEther("10"), await testToken.getAddress());

            const amount = 1000;
            const totalPrice = ethers.parseEther("10000");
            
            // 给用户足够的代币
            await testToken.mint(addr1.address, totalPrice);
            await testToken.connect(addr1).approve(await marketplace.getAddress(), totalPrice);

            await marketplace.connect(addr1).buyTokens(2, amount);
            expect(await ipModel.balanceOf(addr1.address, 2)).to.equal(amount);
        });

        it("Should revert when insufficient allowance", async function () {
            const amount = 2;
            const insufficientAllowance = ethers.parseEther("50"); // 需要100但只授权50

            await testToken.connect(addr1).approve(await marketplace.getAddress(), insufficientAllowance);

            await expect(marketplace.connect(addr1).buyTokens(1, amount))
                .to.be.reverted; // ERC20会抛出不足的错误
        });

        it("Should revert when insufficient balance", async function () {
            const amount = 50; // 需要2500个代币但用户只有1000个
            const totalPrice = ethers.parseEther("2500");

            await testToken.connect(addr1).approve(await marketplace.getAddress(), totalPrice);

            await expect(marketplace.connect(addr1).buyTokens(1, amount))
                .to.be.reverted; // ERC20会抛出余额不足的错误
        });
    });

    describe("Integration Tests", function () {
        it("Should handle multiple users buying from multiple groups", async function () {
            // 创建多个组
            await ipModel.createGroup("Model A", "Description A", 100);
            await ipModel.createGroup("Model B", "Description B", 200);
            
            await ipModel.setGroupPriceAndToken(1, ethers.parseEther("10"), await testToken.getAddress());
            await ipModel.setGroupPriceAndToken(2, ethers.parseEther("20"), await testToken.getAddress());

            // 用户1购买Model A
            await testToken.connect(addr1).approve(await marketplace.getAddress(), ethers.parseEther("20"));
            await marketplace.connect(addr1).buyTokens(1, 2);

            // 用户2购买Model B
            await testToken.connect(addr2).approve(await marketplace.getAddress(), ethers.parseEther("40"));
            await marketplace.connect(addr2).buyTokens(2, 2);

            // 验证余额
            expect(await ipModel.balanceOf(addr1.address, 1)).to.equal(2);
            expect(await ipModel.balanceOf(addr2.address, 2)).to.equal(2);

            // 验证收款地址收到的总金额
            const totalReceived = await testToken.balanceOf(recipient.address);
            expect(totalReceived).to.equal(ethers.parseEther("60")); // 20 + 40
        });

        it("Should work with recipient change", async function () {
            await ipModel.createGroup("Test Model", "Test Description", 1000);
            await ipModel.setGroupPriceAndToken(1, ethers.parseEther("10"), await testToken.getAddress());

            // 用户1购买
            await testToken.connect(addr1).approve(await marketplace.getAddress(), ethers.parseEther("10"));
            await marketplace.connect(addr1).buyTokens(1, 1);

            // 更换收款地址
            await marketplace.setRecipient(addr3.address);

            // 用户2购买
            await testToken.connect(addr2).approve(await marketplace.getAddress(), ethers.parseEther("10"));
            await marketplace.connect(addr2).buyTokens(1, 1);

            // 验证两个收款地址都收到了正确的金额
            expect(await testToken.balanceOf(recipient.address)).to.equal(ethers.parseEther("10"));
            expect(await testToken.balanceOf(addr3.address)).to.equal(ethers.parseEther("10"));
        });

        it("Should handle price changes correctly", async function () {
            await ipModel.createGroup("Dynamic Price Model", "Dynamic Description", 1000);
            await ipModel.setGroupPriceAndToken(1, ethers.parseEther("10"), await testToken.getAddress());

            // 用户1以原价购买
            await testToken.connect(addr1).approve(await marketplace.getAddress(), ethers.parseEther("10"));
            await marketplace.connect(addr1).buyTokens(1, 1);

            // 更改价格
            await ipModel.setGroupPriceAndToken(1, ethers.parseEther("20"), await testToken.getAddress());

            // 用户2以新价格购买
            await testToken.connect(addr2).approve(await marketplace.getAddress(), ethers.parseEther("20"));
            await marketplace.connect(addr2).buyTokens(1, 1);

            // 验证收款地址收到的总金额
            const totalReceived = await testToken.balanceOf(recipient.address);
            expect(totalReceived).to.equal(ethers.parseEther("30")); // 10 + 20
        });
    });

    describe("Reentrancy Protection", function () {
        it("Should prevent reentrancy attacks", async function () {
            await ipModel.createGroup("Test Model", "Test Description", 1000);
            await ipModel.setGroupPriceAndToken(1, ethers.parseEther("10"), await testToken.getAddress());

            // 连续快速调用应该都成功（测试nonReentrant修饰符）
            await testToken.connect(addr1).approve(await marketplace.getAddress(), ethers.parseEther("100"));
            
            const promises = [];
            for (let i = 0; i < 5; i++) {
                promises.push(marketplace.connect(addr1).buyTokens(1, 1));
            }
            
            await Promise.all(promises);
            expect(await ipModel.balanceOf(addr1.address, 1)).to.equal(5);
        });
    });

    describe("Edge Cases", function () {
        it("Should handle very large purchases", async function () {
            await ipModel.createGroup("Large Model", "Large Description", 0); // unlimited
            await ipModel.setGroupPriceAndToken(1, ethers.parseEther("1"), await testToken.getAddress());

            const largeAmount = 1000;
            const totalPrice = ethers.parseEther("1000");
            
            await testToken.mint(addr1.address, totalPrice);
            await testToken.connect(addr1).approve(await marketplace.getAddress(), totalPrice);

            await marketplace.connect(addr1).buyTokens(1, largeAmount);
            expect(await ipModel.balanceOf(addr1.address, 1)).to.equal(largeAmount);
        });

        it("Should handle exact max supply boundary", async function () {
            await ipModel.createGroup("Boundary Model", "Boundary Description", 10);
            await ipModel.setGroupPriceAndToken(1, ethers.parseEther("10"), await testToken.getAddress());

            const totalPrice = ethers.parseEther("100");
            await testToken.connect(addr1).approve(await marketplace.getAddress(), totalPrice);

            // 购买恰好达到最大供应量
            await marketplace.connect(addr1).buyTokens(1, 10);
            expect(await ipModel.balanceOf(addr1.address, 1)).to.equal(10);

            // 再次购买应该失败
            await testToken.connect(addr2).approve(await marketplace.getAddress(), ethers.parseEther("10"));
            await expect(marketplace.connect(addr2).buyTokens(1, 1))
                .to.be.revertedWith("Marketplace: Exceeds max supply");
        });
    });
});
