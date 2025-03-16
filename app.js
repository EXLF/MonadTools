class NFTMinter {
    constructor() {
        this.web3 = new Web3('https://testnet-rpc.monad.xyz/');
        this.baseABI = [
            {"inputs":[{"type":"address"},{"type":"uint256"},{"type":"uint256"},{"type":"bytes"}],"name":"mint","outputs":[],"stateMutability":"payable","type":"function"}
        ];
        
        // 初始化UI元素
        this.privateKeyInput = document.getElementById('privateKey');
        this.nftAddressInput = document.getElementById('nftAddress');
        this.priceInput = document.getElementById('price');
        this.quantityInput = document.getElementById('quantity');
        this.mintButton = document.getElementById('mintButton');
        this.mintLog = document.getElementById('mintLog');
        this.walletInfo = document.getElementById('walletAddress');
        
        // 绑定事件
        this.mintButton.addEventListener('click', () => this.mint());
        this.privateKeyInput.addEventListener('input', () => this.updateWalletInfo());
        
        // 初始化状态
        this.updateButtonState();
        
        // 监听输入变化
        const inputs = [this.privateKeyInput, this.nftAddressInput, this.quantityInput];
        inputs.forEach(input => {
            input.addEventListener('input', () => this.updateButtonState());
        });
        
        // 价格输入框单独处理，允许为空
        this.priceInput.addEventListener('input', () => this.updateButtonState());
    }
    
    updateButtonState() {
        const isValid = this.privateKeyInput.value && 
                       this.nftAddressInput.value && 
                       this.quantityInput.value > 0 &&
                       (this.priceInput.value === '' || this.priceInput.value > 0); // 价格可以为空或大于0
        this.mintButton.disabled = !isValid;
    }
    
    log(message, type = 'info') {
        const div = document.createElement('div');
        div.textContent = `${new Date().toLocaleTimeString()} - ${message}`;
        div.className = type;
        this.mintLog.insertBefore(div, this.mintLog.firstChild);
    }
    
    async updateWalletInfo() {
        try {
            if (this.privateKeyInput.value) {
                const account = this.web3.eth.accounts.privateKeyToAccount(this.privateKeyInput.value);
                const balance = await this.web3.eth.getBalance(account.address);
                const balanceInMON = this.web3.utils.fromWei(balance, 'ether');
                this.walletInfo.textContent = `钱包地址: ${account.address}\n余额: ${balanceInMON} MON`;
            } else {
                this.walletInfo.textContent = '请输入私钥';
            }
        } catch (error) {
            this.walletInfo.textContent = '无效的私钥';
        }
    }
    
    async getLatestMintPrice(contractAddress, retryCount = 0) {
        try {
            const latestBlock = await this.web3.eth.getBlockNumber();
            // 每次重试增加查询的区块范围
            const blockRange = 100 * Math.pow(2, retryCount); // 100, 200, 400, 800
            const fromBlock = Math.max(0, Number(latestBlock) - blockRange);
            
            this.log(`尝试第 ${retryCount + 1} 次获取价格，查询区块范围: ${fromBlock} 至 ${latestBlock}`);
            
            const mintMethodId = '0x9b4f3af5';
            
            const logs = await this.web3.eth.getPastLogs({
                fromBlock: fromBlock,
                toBlock: 'latest',
                address: contractAddress
            });
            
            if (!logs || logs.length === 0) {
                if (retryCount < 3) {
                    this.log(`未找到mint记录，扩大查询范围重试...`);
                    return await this.getLatestMintPrice(contractAddress, retryCount + 1);
                }
                throw new Error('未找到任何mint记录');
            }
            
            const transactions = [];
            for (const log of logs) {
                const tx = await this.web3.eth.getTransaction(log.transactionHash);
                if (tx && tx.input.startsWith(mintMethodId)) {
                    const receipt = await this.web3.eth.getTransactionReceipt(log.transactionHash);
                    if (receipt && receipt.status) {
                        transactions.push({
                            hash: tx.hash,
                            value: tx.value,
                            blockNumber: parseInt(tx.blockNumber)
                        });
                    }
                }
            }
            
            if (transactions.length === 0) {
                if (retryCount < 3) {
                    this.log(`未找到成功的mint记录，扩大查询范围重试...`);
                    return await this.getLatestMintPrice(contractAddress, retryCount + 1);
                }
                throw new Error('未找到成功的mint记录');
            }
            
            transactions.sort((a, b) => b.blockNumber - a.blockNumber);
            const latestTx = transactions[0];
            
            this.log(`找到最新mint价格: ${this.web3.utils.fromWei(latestTx.value, 'ether')} MON`);
            this.log(`交易哈希: ${latestTx.hash}`);
            this.log(`区块号: ${latestTx.blockNumber}`);
            
            if (transactions.length > 1) {
                this.log('历史mint价格:');
                for (let i = 1; i < Math.min(5, transactions.length); i++) {
                    const tx = transactions[i];
                    this.log(`- ${this.web3.utils.fromWei(tx.value, 'ether')} MON (区块: ${tx.blockNumber})`);
                }
            }
            
            return latestTx.value;
        } catch (error) {
            if (retryCount < 3) {
                this.log(`获取价格失败，正在重试... (${error.message})`);
                return await this.getLatestMintPrice(contractAddress, retryCount + 1);
            }
            throw new Error(`获取历史价格失败: ${error.message}`);
        }
    }
    
    async mint() {
        try {
            this.mintButton.disabled = true;
            this.log('开始mint流程...');
            
            // 验证输入
            const privateKey = this.privateKeyInput.value;
            const contractAddress = this.nftAddressInput.value;
            const amount = parseInt(this.quantityInput.value);
            
            if (!privateKey || !contractAddress || amount <= 0) {
                throw new Error('请填写所有必需的字段');
            }
            
            // 添加账户
            const account = this.web3.eth.accounts.privateKeyToAccount(privateKey);
            this.web3.eth.accounts.wallet.add(account);
            
            // 获取价格
            let priceInWei;
            if (this.priceInput.value) {
                // 如果用户输入了价格，使用用户输入的价格
                priceInWei = this.web3.utils.toWei(this.priceInput.value.toString(), 'ether');
                this.log('使用手动输入的价格');
            } else {
                // 否则获取历史价格（带重试机制）
                this.log('正在获取历史mint价格...');
                priceInWei = await this.getLatestMintPrice(contractAddress);
                if (!priceInWei) {
                    throw new Error('无法获取mint价格，请手动输入价格');
                }
            }
            
            // 计算总价
            const totalPrice = BigInt(priceInWei) * BigInt(amount);
            
            // 构建交易数据
            const functionSignature = '0x9b4f3af5';
            const encodedParams = this.web3.eth.abi.encodeParameters(
                ['address', 'uint256', 'uint256', 'bytes'],
                [account.address, '0', amount.toString(), '0x']
            );
            const data = functionSignature + encodedParams.slice(2);
            
            // 构建交易对象
            const tx = {
                from: account.address,
                to: contractAddress,
                value: totalPrice.toString(),
                data: data,
                chainId: 10143,
                gasPrice: BigInt(this.web3.utils.toWei('50', 'gwei')).toString()
            };
            
            // 打印交易信息
            this.log('准备mint:', 'info');
            this.log(`合约地址: ${contractAddress}`);
            this.log(`数量: ${amount}`);
            this.log(`单价: ${this.web3.utils.fromWei(priceInWei, 'ether')} MON`);
            this.log(`总价: ${this.web3.utils.fromWei(totalPrice.toString(), 'ether')} MON`);
            this.log(`钱包地址: ${account.address}`);
            
            // 估算gas
            try {
                const gasEstimate = await this.web3.eth.estimateGas(tx);
                tx.gas = Math.floor(Number(gasEstimate) * 1.2).toString();
                this.log(`预估Gas: ${tx.gas}`);
            } catch (error) {
                this.log('Gas估算失败，使用默认值: 2000000', 'error');
                tx.gas = '2000000';
            }
            
            // 发送交易
            this.log('正在发送交易...');
            const signedTx = await this.web3.eth.accounts.signTransaction(tx, account.privateKey);
            const receipt = await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction);
            
            this.log('Mint成功！', 'success');
            this.log(`交易哈希: ${receipt.transactionHash}`, 'success');
            this.log(`区块号: ${receipt.blockNumber}`, 'success');
            
            // 更新钱包信息
            await this.updateWalletInfo();
            
        } catch (error) {
            this.log(`Mint失败: ${error.message}`, 'error');
            if (error.reason) this.log(`错误原因: ${error.reason}`, 'error');
        } finally {
            this.updateButtonState();
        }
    }
}

// 初始化应用
window.addEventListener('load', () => {
    window.nftMinter = new NFTMinter();
}); 