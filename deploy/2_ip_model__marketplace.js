
module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const ipModleAddress = (await deployments.get('IPModel')).address;

    await deploy('IPModelMarketplace', {
        from: deployer,
        args: [ipModleAddress, deployer],
        log: true,
        skipIfAlreadyDeployed: true,
    });
}

module.exports.tags = ['IPModelMarketplace'];