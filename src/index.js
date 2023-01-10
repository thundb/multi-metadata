const ethers = require("ethers");
const Web3 = require("web3");
const Axios = require("axios");

const supportChain = {
  eth: "eth",
};

const chainConfig = {
  [supportChain.eth]: {
    rpc: "https://rpc.ankr.com/eth",
    multicall: "0x5BA1e12693Dc8F9c48aAD8770482f4739bEeD696",
  },
};

const contractABI = [
  "function tokenURI(uint256 tokenId) external view returns (string memory)",
  "function tryAggregate(bool,tuple(address,bytes)[]) returns (tuple(bool,bytes)[])",
];

const web3 = new Web3();
const axios = Axios.create({ timeout: 5000 });

const ipfsUrl = (url) =>
  (url || "").replace("ipfs://", "https://gateway.ipfs.io/ipfs/");

const mockCall = async ({ rpc, contract, callData }) => {
  try {
    const instance = new Web3(rpc);
    instance.extend({
      methods: [{ name: "customCall", call: "eth_call", params: 3 }],
    });

    const params = { to: contract, data: callData };
    const result = await instance.customCall(params, "latest", {});

    return result;
  } catch (error) {
    return "0x";
  }
};

const fetchMetadata = async (url) => {
  try {
    const { data } = await axios.get(url);
    return { ...data, image: ipfsUrl(data.image) };
  } catch (error) {
    return { error: error.message };
  }
};

const multicall = async ({ chain, rpc, list }) => {
  if (!Object.keys(supportChain).includes(chain)) {
    return [];
  }

  const rpcApi = rpc || chainConfig[chain].rpc;
  const contractAddress = chainConfig[chain].multicall;
  const provider = new ethers.providers.JsonRpcProvider(rpcApi);
  const contract = new ethers.Contract(contractAddress, contractABI, provider);

  const calls = [];
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    const { data: tokenURI } = await contract.populateTransaction.tokenURI(
      item.tokenId
    );
    calls.push([item.contract, tokenURI]);
  }

  const { data: callData } = await contract.populateTransaction.tryAggregate(
    false,
    calls
  );
  const callResult = await mockCall({
    rpc: rpcApi,
    contract: contractAddress,
    callData,
  });

  const [decodeResult] = ethers.utils.defaultAbiCoder.decode(
    ["tuple(bool,bytes)[]"],
    callResult
  );
  const filterResult = list
    .map((item, index) => {
      const urlStr = web3.utils.hexToUtf8(decodeResult[index][1]);
      const metadata = ipfsUrl(urlStr).replace(/.*http/, "http");
      return { ...item, metadata, success: decodeResult[index][0] };
    })
    .filter((i) => i.success)
    .map((i) => ({
      contract: i.contract,
      tokenId: i.tokenId,
      metadata: i.metadata,
    }));

  const result = [];
  for (let i = 0; i < filterResult.length; i++) {
    const item = filterResult[i];
    const external = await fetchMetadata(item.metadata);
    result.push({ ...item, external });
  }

  return result;
};

module.exports = { multicall, supportChain };
