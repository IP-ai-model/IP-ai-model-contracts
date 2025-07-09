const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("IPModel Integration Tests", function () {
    let IPModel, ipModel, TestToken, testToken;
    let owner, addr1, addr2, addr3;

    beforeEach(async function () {
        [owner, addr1, addr2, addr3] = await ethers.getSigners();

        TestToken = await ethers.getContractFactory("TestToken");
        testToken = await TestToken.deploy();
        await testToken.waitForDeployment();

        IPModel = await ethers.getContractFactory("IPModel");
        ipModel = await IPModel.deploy();
        await ipModel.waitForDeployment();

        // Setup initial tokens for testing
        await testToken.mint(owner.address, ethers.parseEther("10000"));
        await testToken.connect(addr1).faucet(ethers.parseEther("1000"));
        await testToken.connect(addr2).faucet(ethers.parseEther("1000"));
    });

    describe("Real-world Scenarios", function () {
        it("Should handle a complete NFT marketplace flow", async function () {
            // 1. 创建多个NFT组代表不同的AI模型
            await ipModel.createGroup("GPT-4 Model", "Advanced AI Language Model", 1000);
            await ipModel.createGroup("DALL-E Model", "AI Image Generation Model", 500);
            await ipModel.createGroup("Unlimited Model", "Open Source Model", 0);

            // 2. 设置不同的价格
            await ipModel.setGroupPriceAndToken(1, ethers.parseEther("100"), await testToken.getAddress()); // GPT-4: 100 tokens
            await ipModel.setGroupPriceAndToken(2, ethers.parseEther("200"), await testToken.getAddress()); // DALL-E: 200 tokens
            await ipModel.setGroupPriceAndToken(3, ethers.parseEther("10"), await testToken.getAddress());  // Unlimited: 10 tokens

            // 3. 设置URI
            await ipModel.setBaseURI("https://api.aimodels.com/metadata");

            // 4. 授权一个地址作为铸造者（代表市场合约）
            await ipModel.setAuthorizedMinter(addr3.address, true);

            // 5. 用户通过ERC20购买不同模型的访问权限
            const gptPrice = ethers.parseEther("100");
            const dallePrice = ethers.parseEther("200");

            // 用户1购买GPT-4访问权限
            await testToken.connect(addr1).approve(await ipModel.getAddress(), gptPrice);
            await ipModel.connect(addr1).mintWithToken(1, 1);

            // 用户2购买DALL-E访问权限
            await testToken.connect(addr2).approve(await ipModel.getAddress(), dallePrice);
            await ipModel.connect(addr2).mintWithToken(2, 1);

            // 6. 市场合约批量铸造一些免费的开源模型访问权限
            await ipModel.connect(addr3).mint(addr1.address, 3, 10);
            await ipModel.connect(addr3).mint(addr2.address, 3, 10);

            // 7. 验证最终状态
            expect(await ipModel.balanceOf(addr1.address, 1)).to.equal(1); // GPT-4
            expect(await ipModel.balanceOf(addr1.address, 3)).to.equal(10); // Unlimited
            expect(await ipModel.balanceOf(addr2.address, 2)).to.equal(1); // DALL-E
            expect(await ipModel.balanceOf(addr2.address, 3)).to.equal(10); // Unlimited

            // 8. 验证URI
            const gptURI = await ipModel.uri(1);
            expect(gptURI).to.equal("https://api.aimodels.com/metadata/1/1");

            // 9. 验证供应量
            const gptInfo = await ipModel.getGroupInfo(1);
            const dalleInfo = await ipModel.getGroupInfo(2);
            const unlimitedInfo = await ipModel.getGroupInfo(3);

            expect(gptInfo[3]).to.equal(1); // currentSupply
            expect(dalleInfo[3]).to.equal(1);
            expect(unlimitedInfo[3]).to.equal(20);

            // 10. 验证合约收到的ERC20
            const contractBalance = await testToken.balanceOf(await ipModel.getAddress());
            expect(contractBalance).to.equal(ethers.parseEther("300")); // 100 + 200
        });

        it("Should handle group deactivation and reactivation correctly", async function () {
            // 创建组并设置价格
            await ipModel.createGroup("Test Model", "Test Description", 100);
            await ipModel.setGroupPriceAndToken(1, ethers.parseEther("50"), await testToken.getAddress());

            // 先让用户购买一些
            await testToken.connect(addr1).approve(await ipModel.getAddress(), ethers.parseEther("100"));
            await ipModel.connect(addr1).mintWithToken(1, 2);

            expect(await ipModel.balanceOf(addr1.address, 1)).to.equal(2);

            // 暂停组
            await ipModel.setGroupActive(1, false);

            // 确认不能再购买
            await expect(ipModel.connect(addr1).mintWithToken(1, 1))
                .to.be.revertedWith("Group not active");

            // 确认owner也不能mint到非活跃组
            await expect(ipModel.mint(addr2.address, 1, 1))
                .to.be.revertedWith("IPModel: Group is not active");

            // 重新激活
            await ipModel.setGroupActive(1, true);

            // 现在应该可以再次购买
            await testToken.connect(addr1).approve(await ipModel.getAddress(), ethers.parseEther("50")); // 重新授权
            await ipModel.connect(addr1).mintWithToken(1, 1);
            expect(await ipModel.balanceOf(addr1.address, 1)).to.equal(3);
        });

        it("Should handle complex authorization scenarios", async function () {
            await ipModel.createGroup("Test Model", "Test Description", 1000);

            // 授权多个铸造者
            await ipModel.setAuthorizedMinter(addr1.address, true);
            await ipModel.setAuthorizedMinter(addr2.address, true);

            // 两个授权铸造者都应该能够铸造
            await ipModel.connect(addr1).mint(addr3.address, 1, 10);
            await ipModel.connect(addr2).mint(addr3.address, 1, 20);

            expect(await ipModel.balanceOf(addr3.address, 1)).to.equal(30);

            // 取消一个铸造者的授权
            await ipModel.setAuthorizedMinter(addr1.address, false);

            // addr1不能再铸造
            await expect(ipModel.connect(addr1).mint(addr3.address, 1, 5))
                .to.be.revertedWith("IPModel: Not authorized to mint");

            // 但addr2仍然可以
            await ipModel.connect(addr2).mint(addr3.address, 1, 15);
            expect(await ipModel.balanceOf(addr3.address, 1)).to.equal(45);

            // owner始终可以铸造
            await ipModel.mint(addr3.address, 1, 5);
            expect(await ipModel.balanceOf(addr3.address, 1)).to.equal(50);
        });

        it("Should handle price updates correctly", async function () {
            await ipModel.createGroup("Dynamic Price Model", "Model with changing price", 1000);
            
            // 设置初始价格
            const initialPrice = ethers.parseEther("10");
            await ipModel.setGroupPriceAndToken(1, initialPrice, await testToken.getAddress());

            // 用户以初始价格购买
            await testToken.connect(addr1).approve(await ipModel.getAddress(), initialPrice);
            await ipModel.connect(addr1).mintWithToken(1, 1);

            // 更新价格
            const newPrice = ethers.parseEther("20");
            await ipModel.setGroupPriceAndToken(1, newPrice, await testToken.getAddress());

            // 验证新价格生效
            const groupInfo = await ipModel.getGroupInfo(1);
            expect(groupInfo[5]).to.equal(newPrice);

            // 用户需要支付新价格
            await testToken.connect(addr2).approve(await ipModel.getAddress(), newPrice);
            await ipModel.connect(addr2).mintWithToken(1, 1);

            // 验证总收入
            const contractBalance = await testToken.balanceOf(await ipModel.getAddress());
            expect(contractBalance).to.equal(ethers.parseEther("30")); // 10 + 20
        });

        it("Should handle multiple token payments", async function () {
            // 部署另一个测试代币
            const TestToken2 = await ethers.getContractFactory("TestToken");
            const testToken2 = await TestToken2.deploy();
            await testToken2.waitForDeployment();

            await testToken2.mint(owner.address, ethers.parseEther("1000"));
            await testToken2.connect(addr1).faucet(ethers.parseEther("1000"));

            // 创建两个组，使用不同的支付代币
            await ipModel.createGroup("Model A", "Paid with Token 1", 100);
            await ipModel.createGroup("Model B", "Paid with Token 2", 200);

            await ipModel.setGroupPriceAndToken(1, ethers.parseEther("50"), await testToken.getAddress());
            await ipModel.setGroupPriceAndToken(2, ethers.parseEther("30"), await testToken2.getAddress());

            // 用户用不同代币购买
            await testToken.connect(addr1).approve(await ipModel.getAddress(), ethers.parseEther("50"));
            await testToken2.connect(addr1).approve(await ipModel.getAddress(), ethers.parseEther("30"));

            await ipModel.connect(addr1).mintWithToken(1, 1);
            await ipModel.connect(addr1).mintWithToken(2, 1);

            // 验证合约收到了两种代币
            const balance1 = await testToken.balanceOf(await ipModel.getAddress());
            const balance2 = await testToken2.balanceOf(await ipModel.getAddress());

            expect(balance1).to.equal(ethers.parseEther("50"));
            expect(balance2).to.equal(ethers.parseEther("30"));
        });
    });

    describe("Gas Optimization Tests", function () {
        it("Should efficiently handle batch operations", async function () {
            // 创建多个组
            const groupPromises = [];
            for (let i = 0; i < 5; i++) {
                groupPromises.push(ipModel.createGroup(`Model ${i}`, `Description ${i}`, 1000));
            }
            await Promise.all(groupPromises);

            expect(await ipModel.getGroupCount()).to.equal(5);

            // 批量铸造到不同组
            for (let groupId = 1; groupId <= 5; groupId++) {
                await ipModel.mint(addr1.address, groupId, 10);
            }

            // 使用balanceOfBatch检查余额
            const addresses = Array(5).fill(addr1.address);
            const tokenIds = [1, 2, 3, 4, 5];
            const balances = await ipModel.balanceOfBatch(addresses, tokenIds);

            balances.forEach(balance => {
                expect(balance).to.equal(10);
            });
        });
    });

    describe("Error Handling and Edge Cases", function () {
        it("Should handle overflow scenarios gracefully", async function () {
            // 创建一个具有极大最大供应量的组
            const maxUint256 = ethers.MaxUint256;
            await ipModel.createGroup("Max Supply Model", "Model with max supply", maxUint256);

            // 应该能够铸造而不溢出
            await ipModel.mint(addr1.address, 1, 1000000);
            
            const groupInfo = await ipModel.getGroupInfo(1);
            expect(groupInfo[3]).to.equal(1000000); // currentSupply
        });

        it("Should handle zero amount edge cases", async function () {
            await ipModel.createGroup("Test Model", "Test Description", 1000);
            await ipModel.setGroupPriceAndToken(1, ethers.parseEther("10"), await testToken.getAddress());

            // 零数量应该被拒绝
            await expect(ipModel.mint(addr1.address, 1, 0))
                .to.be.revertedWith("IPModel: Amount must be greater than 0");

            await expect(ipModel.connect(addr1).mintWithToken(1, 0))
                .to.be.revertedWith("Amount must be greater than 0");
        });

        it("Should handle string edge cases", async function () {
            // 空字符串
            await ipModel.createGroup("", "", 100);
            
            // 非常长的字符串
            const longString = "A".repeat(1000);
            await ipModel.createGroup(longString, longString, 200);

            // 特殊字符
            await ipModel.createGroup("Model with émojis 🚀", "Description with symbols @#$%", 300);

            expect(await ipModel.getGroupCount()).to.equal(3);
        });

        it("Should properly handle the exact max supply boundary", async function () {
            await ipModel.createGroup("Boundary Test", "Test exact boundary", 100);

            // 铸造到精确的边界
            await ipModel.mint(addr1.address, 1, 100);

            const groupInfo = await ipModel.getGroupInfo(1);
            expect(groupInfo[3]).to.equal(100); // currentSupply
            expect(groupInfo[2]).to.equal(100); // maxSupply

            // 应该不能再铸造任何数量
            await expect(ipModel.mint(addr1.address, 1, 1))
                .to.be.revertedWith("IPModel: Exceeds maximum supply");
        });
    });

    describe("Security Tests", function () {
        it("Should prevent unauthorized access to critical functions", async function () {
            await ipModel.createGroup("Test Model", "Test Description", 1000);

            // 非owner不能创建组
            await expect(ipModel.connect(addr1).createGroup("Hack", "Hack", 1000))
                .to.be.reverted;

            // 非owner不能设置URI
            await expect(ipModel.connect(addr1).setBaseURI("hack://evil.com"))
                .to.be.reverted;

            // 非owner不能设置组状态
            await expect(ipModel.connect(addr1).setGroupActive(1, false))
                .to.be.reverted;

            // 非owner不能设置价格
            await expect(ipModel.connect(addr1).setGroupPriceAndToken(1, ethers.parseEther("1"), await testToken.getAddress()))
                .to.be.reverted;

            // 非授权者不能铸造
            await expect(ipModel.connect(addr1).mint(addr2.address, 1, 1))
                .to.be.revertedWith("IPModel: Not authorized to mint");
        });

        it("Should handle reentrancy safely", async function () {
            // 虽然我们的合约没有明显的重入风险，但测试一些场景
            await ipModel.createGroup("Test Model", "Test Description", 1000);
            await ipModel.setGroupPriceAndToken(1, ethers.parseEther("10"), await testToken.getAddress());

            // 连续快速调用应该都成功
            await testToken.connect(addr1).approve(await ipModel.getAddress(), ethers.parseEther("100"));
            
            const promises = [];
            for (let i = 0; i < 5; i++) {
                promises.push(ipModel.connect(addr1).mintWithToken(1, 1));
            }
            
            await Promise.all(promises);
            expect(await ipModel.balanceOf(addr1.address, 1)).to.equal(5);
        });
    });
});
