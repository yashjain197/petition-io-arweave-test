// src/abi/Profile.js
export const ProfileABI = [
  // Profile
  {
    "inputs": [
      { "internalType": "string", "name": "profileDocArTxId", "type": "string" },
      { "internalType": "string", "name": "profileDocHash", "type": "string" },
      { "internalType": "string", "name": "avatarArTxId", "type": "string" },
      { "internalType": "string", "name": "avatarHash", "type": "string" },
      { "internalType": "string", "name": "firstNameArTxId", "type": "string" },
      { "internalType": "string", "name": "firstNameHash", "type": "string" },
      { "internalType": "string", "name": "lastNameArTxId", "type": "string" },
      { "internalType": "string", "name": "lastNameHash", "type": "string" },
      { "internalType": "string", "name": "bioArTxId", "type": "string" },
      { "internalType": "string", "name": "bioHash", "type": "string" },
      { "internalType": "string", "name": "twitterArTxId", "type": "string" },
      { "internalType": "string", "name": "twitterHash", "type": "string" },
      { "internalType": "string", "name": "githubArTxId", "type": "string" },
      { "internalType": "string", "name": "githubHash", "type": "string" },
      { "internalType": "string", "name": "etherscanArTxId", "type": "string" },
      { "internalType": "string", "name": "etherscanHash", "type": "string" },
      { "internalType": "string", "name": "telegramArTxId", "type": "string" },
      { "internalType": "string", "name": "telegramHash", "type": "string" },
      { "internalType": "string", "name": "ensArTxId", "type": "string" },
      { "internalType": "string", "name": "ensHash", "type": "string" }
    ],
    "name": "updateProfile",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },

  // Signature versions
  {
    "inputs": [
      { "internalType": "string", "name": "arTxId", "type": "string" },
      { "internalType": "string", "name": "contentHash", "type": "string" },
      { "internalType": "bool", "name": "activate", "type": "bool" }
    ],
    "name": "saveSignatureVersion",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "index", "type": "uint256" }],
    "name": "setActiveSignatureVersion",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "user", "type": "address" }],
    "name": "getActiveSignatureVersion",
    "outputs": [
      { "internalType": "string", "name": "arTxId", "type": "string" },
      { "internalType": "string", "name": "contentHash", "type": "string" },
      { "internalType": "uint64", "name": "createdAt", "type": "uint64" },
      { "internalType": "bool", "name": "isActive", "type": "bool" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "user", "type": "address" }],
    "name": "getSignatureVersionsCount",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },

  // Campaign signing state
  {
    "inputs": [{ "internalType": "uint256", "name": "campaignId", "type": "uint256" }],
    "name": "publicSign",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "campaignId", "type": "uint256" },
      { "internalType": "address", "name": "user", "type": "address" }
    ],
    "name": "hasSigned",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "campaignId", "type": "uint256" }],
    "name": "getSignatureCount",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
];
