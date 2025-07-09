const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("IPModel", function () {
    let IPModel, ipModel, TestToken, testToken;
    let owner, addr1, addr2, addr3;
    let groupId;

    beforeEach(async function () {
        // 获取签名者
        [owner, addr1, addr2, addr3] = await ethers.getSigners();

        // 部署TestToken合约
        TestToken = await ethers.getContractFactory("TestToken");
        testToken = await TestToken.deploy();
        await testToken.waitForDeployment();

        // 部署IPModel合约
        IPModel = await ethers.getContractFactory("IPModel");
        ipModel = await IPModel.deploy();
        await ipModel.waitForDeployment();

        // 为测试用户铸造一些测试代币
        await testToken.faucet(ethers.parseEther("1000"));
        await testToken.connect(addr1).faucet(ethers.parseEther("1000"));
        await testToken.connect(addr2).faucet(ethers.parseEther("1000"));
    });

    describe("Deployment", function () {
        it("Should set the right owner", async function () {
            expect(await ipModel.owner()).to.equal(owner.address);
        });

        it("Should initialize with correct values", async function () {
            expect(await ipModel.getGroupCount()).to.equal(0);
            expect(await ipModel.baseURI()).to.equal("");
        });
    });

    describe("Group Management", function () {
        it("Should create a new group", async function () {
            await expect(ipModel.createGroup("Test Group", "Test Description", 1000))
                .to.emit(ipModel, "GroupCreated")
                .withArgs(1, "Test Group", 1000);

            expect(await ipModel.getGroupCount()).to.equal(1);
            
            const groupInfo = await ipModel.getGroupInfo(1);
            expect(groupInfo[0]).to.equal("Test Group"); // name
            expect(groupInfo[1]).to.equal("Test Description"); // description
            expect(groupInfo[2]).to.equal(1000); // maxSupply
            expect(groupInfo[3]).to.equal(0); // currentSupply
            expect(groupInfo[4]).to.equal(true); // isActive
            expect(groupInfo[5]).to.equal(0); // price
            expect(groupInfo[6]).to.equal(ethers.ZeroAddress); // payToken
        });

        it("Should only allow owner to create groups", async function () {
            await expect(ipModel.connect(addr1).createGroup("Test Group", "Test Description", 1000))
                .to.be.reverted;
        });

        it("Should create multiple groups with incremental IDs", async function () {
            await ipModel.createGroup("Group 1", "Description 1", 100);
            await ipModel.createGroup("Group 2", "Description 2", 200);
            await ipModel.createGroup("Group 3", "Description 3", 0); // unlimited supply

            expect(await ipModel.getGroupCount()).to.equal(3);

            const group1 = await ipModel.getGroupInfo(1);
            const group2 = await ipModel.getGroupInfo(2);
            const group3 = await ipModel.getGroupInfo(3);

            expect(group1[0]).to.equal("Group 1");
            expect(group2[0]).to.equal("Group 2");
            expect(group3[0]).to.equal("Group 3");
            expect(group3[2]).to.equal(0); // unlimited supply
        });

        it("Should set group active status", async function () {
            await ipModel.createGroup("Test Group", "Test Description", 1000);
            
            await ipModel.setGroupActive(1, false);
            const groupInfo = await ipModel.getGroupInfo(1);
            expect(groupInfo[4]).to.equal(false); // isActive

            await ipModel.setGroupActive(1, true);
            const groupInfo2 = await ipModel.getGroupInfo(1);
            expect(groupInfo2[4]).to.equal(true); // isActive
        });

        it("Should revert when setting active status for non-existent group", async function () {
            await expect(ipModel.setGroupActive(999, true))
                .to.be.revertedWith("IPModel: Group does not exist");
        });

        it("Should set group price and pay token", async function () {
            await ipModel.createGroup("Test Group", "Test Description", 1000);
            
            const price = ethers.parseEther("10");
            await ipModel.setGroupPriceAndToken(1, price, await testToken.getAddress());

            const groupInfo = await ipModel.getGroupInfo(1);
            expect(groupInfo[5]).to.equal(price); // price
            expect(groupInfo[6]).to.equal(await testToken.getAddress()); // payToken
        });

        it("Should revert when setting price for non-existent group", async function () {
            await expect(ipModel.setGroupPriceAndToken(999, ethers.parseEther("10"), await testToken.getAddress()))
                .to.be.revertedWith("Group not exist");
        });
    });

    describe("Authorization", function () {
        beforeEach(async function () {
            await ipModel.createGroup("Test Group", "Test Description", 1000);
            groupId = 1;
        });

        it("Should authorize and deauthorize minters", async function () {
            expect(await ipModel.authorizedMinters(addr1.address)).to.equal(false);

            await expect(ipModel.setAuthorizedMinter(addr1.address, true))
                .to.emit(ipModel, "MinterAuthorized")
                .withArgs(addr1.address, true);

            expect(await ipModel.authorizedMinters(addr1.address)).to.equal(true);

            await expect(ipModel.setAuthorizedMinter(addr1.address, false))
                .to.emit(ipModel, "MinterAuthorized")
                .withArgs(addr1.address, false);

            expect(await ipModel.authorizedMinters(addr1.address)).to.equal(false);
        });

        it("Should revert when setting zero address as minter", async function () {
            await expect(ipModel.setAuthorizedMinter(ethers.ZeroAddress, true))
                .to.be.revertedWith("IPModel: Invalid minter address");
        });

        it("Should only allow owner to set authorized minters", async function () {
            await expect(ipModel.connect(addr1).setAuthorizedMinter(addr2.address, true))
                .to.be.reverted;
        });
    });

    describe("Minting", function () {
        beforeEach(async function () {
            await ipModel.createGroup("Test Group", "Test Description", 1000);
            groupId = 1;
        });

        it("Should allow owner to mint tokens", async function () {
            await expect(ipModel.mint(addr1.address, groupId, 10))
                .to.emit(ipModel, "TokensMinted")
                .withArgs(groupId, addr1.address, 10);

            expect(await ipModel.balanceOf(addr1.address, groupId)).to.equal(10);
            
            const groupInfo = await ipModel.getGroupInfo(groupId);
            expect(groupInfo[3]).to.equal(10); // currentSupply
        });

        it("Should allow authorized minters to mint tokens", async function () {
            await ipModel.setAuthorizedMinter(addr1.address, true);

            await expect(ipModel.connect(addr1).mint(addr2.address, groupId, 5))
                .to.emit(ipModel, "TokensMinted")
                .withArgs(groupId, addr2.address, 5);

            expect(await ipModel.balanceOf(addr2.address, groupId)).to.equal(5);
        });

        it("Should revert when unauthorized user tries to mint", async function () {
            await expect(ipModel.connect(addr1).mint(addr2.address, groupId, 5))
                .to.be.revertedWith("IPModel: Not authorized to mint");
        });

        it("Should revert when minting to inactive group", async function () {
            await ipModel.setGroupActive(groupId, false);

            await expect(ipModel.mint(addr1.address, groupId, 10))
                .to.be.revertedWith("IPModel: Group is not active");
        });

        it("Should revert when amount is zero", async function () {
            await expect(ipModel.mint(addr1.address, groupId, 0))
                .to.be.revertedWith("IPModel: Amount must be greater than 0");
        });

        it("Should respect max supply limits", async function () {
            // 先铸造990个代币，接近1000的上限
            await ipModel.mint(addr1.address, groupId, 990);

            // 应该可以再铸造10个
            await ipModel.mint(addr1.address, groupId, 10);

            // 应该不能再铸造更多
            await expect(ipModel.mint(addr1.address, groupId, 1))
                .to.be.revertedWith("IPModel: Exceeds maximum supply");
        });

        it("Should allow unlimited minting when max supply is 0", async function () {
            await ipModel.createGroup("Unlimited Group", "Unlimited Description", 0);
            const unlimitedGroupId = 2;

            // 应该可以铸造大量代币
            await ipModel.mint(addr1.address, unlimitedGroupId, 1000000);
            expect(await ipModel.balanceOf(addr1.address, unlimitedGroupId)).to.equal(1000000);

            // 还应该可以继续铸造
            await ipModel.mint(addr1.address, unlimitedGroupId, 1000000);
            expect(await ipModel.balanceOf(addr1.address, unlimitedGroupId)).to.equal(2000000);
        });
    });

    describe("Price and Token Management", function () {
        beforeEach(async function () {
            await ipModel.createGroup("Paid Group", "Paid Description", 1000);
            groupId = 1;
            
            const price = ethers.parseEther("10"); // 10 tokens per NFT
            await ipModel.setGroupPriceAndToken(groupId, price, await testToken.getAddress());
        });

        it("Should store price and token information correctly", async function () {
            const groupInfo = await ipModel.getGroupInfo(groupId);
            expect(groupInfo[5]).to.equal(ethers.parseEther("10")); // price
            expect(groupInfo[6]).to.equal(await testToken.getAddress()); // payToken
        });

        it("Should allow owner to update price and token", async function () {
            const newPrice = ethers.parseEther("20");
            await ipModel.setGroupPriceAndToken(groupId, newPrice, await testToken.getAddress());
            
            const groupInfo = await ipModel.getGroupInfo(groupId);
            expect(groupInfo[5]).to.equal(newPrice); // price
        });
    });

    describe("URI and Metadata", function () {
        beforeEach(async function () {
            await ipModel.createGroup("Test Group", "Test Description", 1000);
            groupId = 1;
        });

        it("Should set and get base URI", async function () {
            await ipModel.setBaseURI("https://api.example.com/metadata");
            expect(await ipModel.baseURI()).to.equal("https://api.example.com/metadata");
        });

        it("Should only allow owner to set base URI", async function () {
            await expect(ipModel.connect(addr1).setBaseURI("https://api.example.com/metadata"))
                .to.be.reverted;
        });

        it("Should return correct URI for tokens", async function () {
            await ipModel.setBaseURI("https://api.example.com/metadata");
            await ipModel.mint(addr1.address, groupId, 1);

            const uri = await ipModel.uri(groupId);
            expect(uri).to.equal(`https://api.example.com/metadata/${groupId}/${groupId}`);
        });

        it("Should return empty string when base URI is not set", async function () {
            await ipModel.mint(addr1.address, groupId, 1);
            const uri = await ipModel.uri(groupId);
            expect(uri).to.equal("");
        });

        it("Should revert when getting URI for non-existent token", async function () {
            await expect(ipModel.uri(999))
                .to.be.revertedWith("IPModel: Token group does not exist");
        });
    });

    describe("Batch Operations", function () {
        beforeEach(async function () {
            await ipModel.createGroup("Group 1", "Description 1", 1000);
            await ipModel.createGroup("Group 2", "Description 2", 2000);
            await ipModel.createGroup("Group 3", "Description 3", 0);
        });

        it("Should handle multiple groups correctly", async function () {
            await ipModel.mint(addr1.address, 1, 10);
            await ipModel.mint(addr1.address, 2, 20);
            await ipModel.mint(addr1.address, 3, 30);

            expect(await ipModel.balanceOf(addr1.address, 1)).to.equal(10);
            expect(await ipModel.balanceOf(addr1.address, 2)).to.equal(20);
            expect(await ipModel.balanceOf(addr1.address, 3)).to.equal(30);

            // 检查批量余额
            const balances = await ipModel.balanceOfBatch(
                [addr1.address, addr1.address, addr1.address],
                [1, 2, 3]
            );
            expect(balances[0]).to.equal(10);
            expect(balances[1]).to.equal(20);
            expect(balances[2]).to.equal(30);
        });

        it("Should track current supply correctly across groups", async function () {
            await ipModel.mint(addr1.address, 1, 100);
            await ipModel.mint(addr2.address, 1, 200);
            await ipModel.mint(addr1.address, 2, 150);

            const group1Info = await ipModel.getGroupInfo(1);
            const group2Info = await ipModel.getGroupInfo(2);

            expect(group1Info[3]).to.equal(300); // currentSupply for group 1
            expect(group2Info[3]).to.equal(150); // currentSupply for group 2
        });
    });

    describe("Edge Cases", function () {
        it("Should handle zero max supply (unlimited) correctly", async function () {
            await ipModel.createGroup("Unlimited Group", "Unlimited", 0);
            
            // 应该可以铸造任意数量
            await ipModel.mint(addr1.address, 1, 1000000);
            await ipModel.mint(addr1.address, 1, 1000000);
            
            const groupInfo = await ipModel.getGroupInfo(1);
            expect(groupInfo[2]).to.equal(0); // maxSupply
            expect(groupInfo[3]).to.equal(2000000); // currentSupply
        });

        it("Should handle very large numbers", async function () {
            const largeSupply = ethers.parseEther("1000000000"); // 10亿
            await ipModel.createGroup("Large Group", "Large", largeSupply);

            // 应该可以创建具有大数量上限的组
            const groupInfo = await ipModel.getGroupInfo(1);
            expect(groupInfo[2]).to.equal(largeSupply);
        });

        it("Should maintain separate supplies for different groups", async function () {
            await ipModel.createGroup("Group A", "Description A", 100);
            await ipModel.createGroup("Group B", "Description B", 200);

            await ipModel.mint(addr1.address, 1, 50);
            await ipModel.mint(addr1.address, 2, 100);

            // 组1应该还能铸造50个
            await ipModel.mint(addr1.address, 1, 50);
            
            // 组2应该还能铸造100个
            await ipModel.mint(addr1.address, 2, 100);

            // 但是现在都应该达到上限
            await expect(ipModel.mint(addr1.address, 1, 1))
                .to.be.revertedWith("IPModel: Exceeds maximum supply");
            
            await expect(ipModel.mint(addr1.address, 2, 1))
                .to.be.revertedWith("IPModel: Exceeds maximum supply");
        });
    });

    describe("Interface Support", function () {
        it("Should support ERC1155 interface", async function () {
            // ERC1155 interface ID: 0xd9b67a26
            expect(await ipModel.supportsInterface("0xd9b67a26")).to.equal(true);
        });

        it("Should support ERC165 interface", async function () {
            // ERC165 interface ID: 0x01ffc9a7
            expect(await ipModel.supportsInterface("0x01ffc9a7")).to.equal(true);
        });
    });
});
