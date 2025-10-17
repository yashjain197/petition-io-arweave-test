// src/abi/PetitionCore.js
// Minimal ABI aligned to the new PetitionCore contract usage in this app.
export const PetitionCoreABI = [
  // Events (light)
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true,  "internalType": "uint256", "name": "campaignId", "type": "uint256" },
      { "indexed": true,  "internalType": "address", "name": "signer", "type": "address" },
      { "indexed": false, "internalType": "string",  "name": "message", "type": "string" }
    ],
    "name": "SignatureAddedLight",
    "type": "event"
  },

  // Views
  {
    "inputs": [{ "internalType": "uint256", "name": "_campaignId", "type": "uint256" }],
    "name": "getCampaignInfo",
    "outputs": [
      {
        "components": [
          { "internalType": "uint256", "name": "id", "type": "uint256" },
          { "internalType": "string",  "name": "title", "type": "string" },
          { "internalType": "string",  "name": "description", "type": "string" },
          { "internalType": "address", "name": "creator", "type": "address" },
          { "internalType": "address", "name": "beneficiary", "type": "address" },
          { "internalType": "uint256", "name": "targetAmount", "type": "uint256" },
          { "internalType": "uint256", "name": "totalRaised", "type": "uint256" },
          { "internalType": "uint256", "name": "signatureCount", "type": "uint256" },
          { "internalType": "uint256", "name": "contributionCount", "type": "uint256" },
          { "internalType": "uint256", "name": "deadline", "type": "uint256" },
          { "internalType": "bool",    "name": "isActive", "type": "bool" },
          { "internalType": "bool",    "name": "fundsWithdrawn", "type": "bool" },
          { "internalType": "bool",    "name": "isDaoCampaign", "type": "bool" },
          { "internalType": "string",  "name": "imageArTxId", "type": "string" },
          { "internalType": "string",  "name": "imageContentHash", "type": "string" }
        ],
        "internalType": "struct PetitionCore.Campaign",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },

  // Helpers
  {
    "inputs": [{ "internalType": "uint256", "name": "usdFeeCents", "type": "uint256" }],
    "name": "_calculateSignatureFee",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "_campaignId", "type": "uint256" },
      { "internalType": "address", "name": "_user", "type": "address" }
    ],
    "name": "hasUserSigned",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },

  // Writes
  {
    "inputs": [
      { "internalType": "string",  "name": "_title", "type": "string" },
      { "internalType": "string",  "name": "_description", "type": "string" },
      { "internalType": "address", "name": "_beneficiary", "type": "address" },
      { "internalType": "uint256", "name": "_targetAmount", "type": "uint256" },
      { "internalType": "uint256", "name": "_durationInDays", "type": "uint256" },
      { "internalType": "string",  "name": "_imageArTxId", "type": "string" },
      { "internalType": "string",  "name": "_imageContentHash", "type": "string" }
    ],
    "name": "createCampaign",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "_campaignId", "type": "uint256" }],
    "name": "contributeETH",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "_campaignId", "type": "uint256" },
      { "internalType": "string",  "name": "_imageArTxId", "type": "string" },
      { "internalType": "string",  "name": "_imageContentHash", "type": "string" }
    ],
    "name": "updateCampaignImage",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "_campaignId", "type": "uint256" },
      { "internalType": "string",  "name": "_message", "type": "string" }
    ],
    "name": "signPetition",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },

  // Public vars
  {
    "inputs": [],
    "name": "nextCampaignId",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
];
