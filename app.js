class NFTMinter {
    constructor() {
        this.web3 = new Web3('https://testnet-rpc.monad.xyz/');
        this.baseABI = [
            {"inputs":[{"type":"address"},{"type":"uint256"},{"type":"uint256"},{"type":"bytes"}],"name":"mint","outputs":[],"stateMutability":"payable","type":"function"}
        ];
        
        // 缓存相关配置
        this.DB_NAME = 'NFTPriceCache';
        this.STORE_NAME = 'prices';
        this.CACHE_EXPIRY = 30 * 24 * 60 * 60 * 1000; // 30天过期
        
        // 初始化数据库
        this.initDB();
        
        // 初始化UI元素
        this.privateKeyInput = document.getElementById('privateKey');
        this.nftAddressInput = document.getElementById('nftAddress');
        this.priceInput = document.getElementById('price');
        this.quantityInput = document.getElementById('quantity');
        this.mintButton = document.getElementById('mintButton');
        this.mintLog = document.getElementById('mintLog');
        this.walletInfo = document.getElementById('walletAddress');
        
        // 创建LayerHub查询按钮
        this.createLayerHubButton();
        
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
    
    // 初始化数据库
    async initDB() {
        try {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(this.DB_NAME, 1);
                
                request.onerror = (event) => {
                    this.log('❌ 数据库初始化失败', 'error');
                    reject(event.target.error);
                };
                
                request.onsuccess = (event) => {
                    this.db = event.target.result;
                    this.log('✅ 数据库连接成功');
                    resolve();
                };
                
                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains(this.STORE_NAME)) {
                        db.createObjectStore(this.STORE_NAME, { keyPath: 'contractAddress' });
                        this.log('✨ 创建缓存存储');
                    }
                };
            });
        } catch (error) {
            this.log(`❌ 数据库初始化失败: ${error.message}`, 'error');
        }
    }

    // 保存价格到缓存
    async savePriceToCache(contractAddress, price, blockNumber) {
        try {
            // 验证参数
            if (!contractAddress || !price || !blockNumber) {
                this.log('❌ 缓存保存失败: 参数无效', 'error');
                return;
            }

            // 等待数据库初始化完成
            if (!this.db) {
                await this.initDB();
            }

            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
                const store = transaction.objectStore(this.STORE_NAME);
                
                // 保存新价格
                const cacheData = {
                    contractAddress,
                    price,
                    blockNumber,
                    timestamp: Date.now()
                };

                // 打印调试信息
                this.log('📝 准备保存缓存数据:');
                this.log(`   合约地址: ${contractAddress}`);
                this.log(`   价格: ${this.web3.utils.fromWei(price, 'ether')} MON`);
                this.log(`   区块: ${blockNumber}`);

                const request = store.put(cacheData);

                request.onsuccess = () => {
                    this.log('✅ 价格已成功保存到缓存');
                    resolve();
                };

                request.onerror = (event) => {
                    this.log(`❌ 缓存保存失败: ${event.target.error}`, 'error');
                    reject(event.target.error);
                };
            });
        } catch (error) {
            this.log(`❌ 缓存保存失败: ${error.message}`, 'error');
            console.error('缓存保存详细错误:', error);
        }
    }

    // 从缓存中获取价格
    async getPriceFromCache(contractAddress) {
        try {
            // 等待数据库初始化完成
            if (!this.db) {
                await this.initDB();
            }

            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
                const store = transaction.objectStore(this.STORE_NAME);
                const request = store.get(contractAddress);

                request.onsuccess = (event) => {
                    const cacheData = event.target.result;
                    if (cacheData) {
                        const now = Date.now();
                        // 检查缓存是否过期
                        if (now - cacheData.timestamp < this.CACHE_EXPIRY) {
                            this.log(`✨ 从缓存获取价格: ${this.web3.utils.fromWei(cacheData.price, 'ether')} MON`);
                            this.log(`   缓存时间: ${new Date(cacheData.timestamp).toLocaleString()}`);
                            this.log(`   区块号: ${cacheData.blockNumber}`);
                            resolve(cacheData.price);
                        } else {
                            this.log('⚠️ 缓存已过期，需要重新获取价格');
                            // 删除过期缓存
                            store.delete(contractAddress);
                            resolve(null);
                        }
                    } else {
                        resolve(null);
                    }
                };

                request.onerror = (event) => {
                    this.log(`❌ 读取缓存失败: ${event.target.error}`, 'error');
                    reject(event.target.error);
                };
            });
        } catch (error) {
            this.log(`❌ 读取缓存失败: ${error.message}`, 'error');
            console.error('缓存读取详细错误:', error);
            return null;
        }
    }
    
    async getLatestMintPrice(contractAddress, retryCount = 0) {
        // 首先尝试从缓存获取价格
        const cachedPrice = await this.getPriceFromCache(contractAddress);
        if (cachedPrice) {
            return cachedPrice;
        }

        try {
            const latestBlock = await this.web3.eth.getBlockNumber();
            // 由于限制为100个区块，我们每次只查询100个区块
            const fromBlock = Math.max(0, Number(latestBlock) - 99);
            
            this.log(`🔍 尝试第 ${retryCount + 1} 次获取价格，查询区块范围: ${fromBlock} 至 ${latestBlock}`);
            
            const mintMethodId = '0x9b4f3af5';
            
            const logs = await this.web3.eth.getPastLogs({
                fromBlock: fromBlock,
                toBlock: latestBlock,
                address: contractAddress
            });
            
            if (!logs || logs.length === 0) {
                if (retryCount < 6) {
                    // 如果没找到，等待一秒后查询下一个100区块范围
                    await new Promise(resolve => setTimeout(resolve, 1000));
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
                if (retryCount < 6) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    return await this.getLatestMintPrice(contractAddress, retryCount + 1);
                }
                throw new Error('未找到成功的mint记录');
            }
            
            transactions.sort((a, b) => b.blockNumber - a.blockNumber);
            const latestTx = transactions[0];
            
            this.log(`找到最新mint价格: ${this.web3.utils.fromWei(latestTx.value, 'ether')} MON`);
            this.log(`交易哈希: ${latestTx.hash}`);
            this.log(`区块号: ${latestTx.blockNumber}`);
            
            // 在成功获取价格后保存到缓存
            await this.savePriceToCache(contractAddress, latestTx.value, latestTx.blockNumber);
            
            return latestTx.value;
        } catch (error) {
            if (error.message.includes('eth_getLogs is limited to a 100 range')) {
                if (retryCount < 6) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    return await this.getLatestMintPrice(contractAddress, retryCount + 1);
                }
            }
            throw error;
        }
    }
    
    async mint() {
        if (this.minting) {
            this.log('⚠️ 正在处理上一个mint请求，请稍候...', 'warning');
            return;
        }
        
        this.minting = true;
        this.mintButton.disabled = true;
        
        try {
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
            
            // 并行处理：同时获取价格和预设gas价格
            const [priceInWei, gasPrice] = await Promise.all([
                // 获取价格
                (async () => {
                    if (this.priceInput.value) {
                        this.log('使用手动输入的价格');
                        return this.web3.utils.toWei(this.priceInput.value.toString(), 'ether');
                    } else {
                        this.log('正在获取历史mint价格...');
                        const price = await this.getLatestMintPrice(contractAddress);
                        if (!price) {
                            throw new Error('无法获取mint价格，请手动输入价格');
                        }
                        return price;
                    }
                })(),
                // 获取gas价格
                Promise.resolve(BigInt(this.web3.utils.toWei('50', 'gwei')).toString())
            ]);
            
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
                gasPrice: gasPrice
            };
            
            // 打印交易信息
            this.log('准备mint:', 'info');
            this.log(`合约地址: ${contractAddress}`);
            this.log(`数量: ${amount}`);
            this.log(`单价: ${this.web3.utils.fromWei(priceInWei, 'ether')} MON`);
            this.log(`总价: ${this.web3.utils.fromWei(totalPrice.toString(), 'ether')} MON`);
            this.log(`钱包地址: ${account.address}`);
            
            // 并行处理：同时进行gas估算和钱包余额检查
            const [gasEstimate, balance] = await Promise.all([
                this.web3.eth.estimateGas(tx).catch(() => '2000000'),
                this.web3.eth.getBalance(account.address)
            ]);

            // 设置gas限制
            tx.gas = Math.floor(Number(gasEstimate) * 1.2).toString();
            const gasCostInWei = BigInt(tx.gas) * BigInt(gasPrice);
            const gasCostInMON = this.web3.utils.fromWei(gasCostInWei.toString(), 'ether');
            this.log(`预估Gas: ${tx.gas} (约 ${gasCostInMON} MON)`);

            // 检查余额是否足够
            const totalCost = BigInt(totalPrice) + gasCostInWei;
            if (BigInt(balance) < totalCost) {
                throw new Error('钱包余额不足，无法完成交易');
            }
            
            // 立即发送交易
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
            this.minting = false;
            this.updateButtonState();
        }
    }

    // 创建LayerHub查询按钮
    createLayerHubButton() {
        // 创建按钮
        const layerHubButton = document.createElement('a');
        layerHubButton.textContent = '查询Monad交易数据';
        layerHubButton.id = 'layerHubButton';
        layerHubButton.target = '_blank'; // 在新标签页打开
        layerHubButton.rel = 'noopener noreferrer'; // 安全设置
        
        // 设置按钮样式
        Object.assign(layerHubButton.style, {
            position: 'absolute',
            top: '20px',
            right: '20px',
            padding: '8px 16px',
            backgroundColor: '#4CAF50',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '4px',
            fontWeight: 'bold',
            boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'background-color 0.3s'
        });
        
        // 添加悬停效果
        layerHubButton.onmouseover = () => {
            layerHubButton.style.backgroundColor = '#45a049';
        };
        layerHubButton.onmouseout = () => {
            layerHubButton.style.backgroundColor = '#4CAF50';
        };
        
        // 添加图标（可选）
        const icon = document.createElement('span');
        icon.innerHTML = '🔍 ';
        layerHubButton.prepend(icon);
        
        // 将按钮添加到页面
        document.body.appendChild(layerHubButton);
        
        // 更新按钮链接
        this.updateLayerHubButtonLink();
        
        // 监听NFT地址输入变化
        this.nftAddressInput.addEventListener('input', () => this.updateLayerHubButtonLink());
    }
    
    // 更新LayerHub按钮链接
    updateLayerHubButtonLink() {
        const button = document.getElementById('layerHubButton');
        if (!button) return;
        
        const baseUrl = 'https://layerhub.xyz/search?p=monad_testnet';
        const contractAddress = this.nftAddressInput.value.trim();
        
        if (contractAddress) {
            // 如果有合约地址，直接链接到该合约的查询页面
            button.href = `https://layerhub.xyz/address/${contractAddress}?p=monad_testnet`;
            button.innerHTML = '🔍 查询此NFT交易数据';
        } else {
            // 否则链接到通用搜索页面
            button.href = baseUrl;
            button.innerHTML = '🔍 查询Monad交易数据';
        }
    }
}

// 初始化应用
window.addEventListener('load', () => {
    window.nftMinter = new NFTMinter();
}); 