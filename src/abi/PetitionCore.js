export const PetitionCoreABI = [
  // --- Events ---
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true,  "internalType": "uint256", "name": "campaignId", "type": "uint256" },
      { "indexed": true,  "internalType": "uint256", "name": "signatureId", "type": "uint256" },
      { "indexed": true,  "internalType": "address", "name": "signer", "type": "address" },
      { "indexed": false, "internalType": "string",  "name": "message", "type": "string" },
      { "indexed": false, "internalType": "uint256", "name": "signatureVersionId", "type": "uint256" },
      { "indexed": false, "internalType": "bytes32", "name": "signedArTxId", "type": "bytes32" },
      { "indexed": false, "internalType": "bytes32", "name": "signedContentHash", "type": "bytes32" }
    ],
    "name": "SignatureAdded",
    "type": "event"
  },

  // --- Signature versioning ---
  {
    "inputs": [
      { "internalType": "bytes32", "name": "arTxId", "type": "bytes32" },
      { "internalType": "bytes32", "name": "contentHash", "type": "bytes32" },
      { "internalType": "uint8",   "name": "encScheme", "type": "uint8" },
      { "internalType": "bool",    "name": "makeActive","type": "bool" },
      { "internalType": "bytes32", "name": "saltOrNonce","type": "bytes32" }
    ],
    "name": "saveSignature",
    "outputs": [{ "internalType": "uint256", "name": "versionId", "type": "uint256" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "bytes32", "name": "arTxId", "type": "bytes32" },
      { "internalType": "bytes32", "name": "contentHash", "type": "bytes32" },
      { "internalType": "uint8",   "name": "encScheme", "type": "uint8" },
      { "internalType": "bytes32", "name": "saltOrNonce", "type": "bytes32" }
    ],
    "name": "updateSignature",
    "outputs": [{ "internalType": "uint256", "name": "versionId", "type": "uint256" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "user", "type": "address" },
      { "internalType": "uint256", "name": "offset", "type": "uint256" },
      { "internalType": "uint256", "name": "limit", "type": "uint256" }
    ],
    "name": "getUserSignatureVersions",
    "outputs": [
      { "internalType": "uint256[]", "name": "versionIds", "type": "uint256[]" },
      {
        "components": [
          { "internalType": "bytes32", "name": "arTxId", "type": "bytes32" },
          { "internalType": "bytes32", "name": "contentHash", "type": "bytes32" },
          { "internalType": "uint64",  "name": "createdAt", "type": "uint64" },
          { "internalType": "bool",    "name": "isActive", "type": "bool" },
          { "internalType": "uint8",   "name": "encScheme", "type": "uint8" },
          { "internalType": "bytes32", "name": "saltOrNonce", "type": "bytes32" }
        ],
        "internalType": "struct PetitionCore.UserSignatureVersion[]",
        "name": "versions",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "user", "type": "address" }],
    "name": "getActiveSignature",
    "outputs": [
      { "internalType": "uint256", "name": "versionId", "type": "uint256" },
      {
        "components": [
          { "internalType": "bytes32", "name": "arTxId", "type": "bytes32" },
          { "internalType": "bytes32", "name": "contentHash", "type": "bytes32" },
          { "internalType": "uint64",  "name": "createdAt", "type": "uint64" },
          { "internalType": "bool",    "name": "isActive", "type": "bool" },
          { "internalType": "uint8",   "name": "encScheme", "type": "uint8" },
          { "internalType": "bytes32", "name": "saltOrNonce", "type": "bytes32" }
        ],
        "internalType": "struct PetitionCore.UserSignatureVersion",
        "name": "version",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },

  // --- Petition signing ---
  {
    "inputs": [
      { "internalType": "uint256", "name": "campaignId", "type": "uint256" },
      { "internalType": "string",  "name": "message", "type": "string" }
    ],
    "name": "signPetition",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "usdFeeCents", "type": "uint256" }],
    "name": "_calculateSignatureFee",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },

  // --- Campaigns (read/list/create) ---
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
          { "internalType": "bool",    "name": "isDaoCampaign", "type": "bool" }
        ],
        "internalType": "struct PetitionCore.Campaign",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "_offset", "type": "uint256" },
      { "internalType": "uint256", "name": "_limit",  "type": "uint256" }
    ],
    "name": "getActiveCampaigns",
    "outputs": [{ "internalType": "uint256[]", "name": "campaignIds", "type": "uint256[]" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "string",  "name": "_title", "type": "string" },
      { "internalType": "string",  "name": "_description", "type": "string" },
      { "internalType": "address", "name": "_beneficiary", "type": "address" },
      { "internalType": "uint256", "name": "_targetAmount", "type": "uint256" },
      { "internalType": "uint256", "name": "_durationInDays", "type": "uint256" }
    ],
    "name": "createCampaign",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },

  // --- Read helpers for receipts ---
  {
    "inputs": [
      { "internalType": "uint256", "name": "signatureId", "type": "uint256" }
    ],
    "name": "getSignatureSnapshot",
    "outputs": [
      { "internalType": "bytes32", "name": "arTxId", "type": "bytes32" },
      { "internalType": "bytes32", "name": "contentHash", "type": "bytes32" },
      { "internalType": "uint256", "name": "versionId", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "campaignId", "type": "uint256" },
      { "internalType": "address", "name": "user", "type": "address" }
    ],
    "name": "getUserSignatureIdForCampaign",
    "outputs": [
      { "internalType": "bool", "name": "found", "type": "bool" },
      { "internalType": "uint256", "name": "signatureId", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },

  // --- New: export helpers for creators/beneficiaries ---
  {
    "inputs": [
      { "internalType": "uint256", "name": "campaignId", "type": "uint256" }
    ],
    "name": "getCampaignSignaturesCount",
    "outputs": [
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "campaignId", "type": "uint256" },
      { "internalType": "uint256", "name": "offset", "type": "uint256" },
      { "internalType": "uint256", "name": "limit", "type": "uint256" }
    ],
    "name": "getCampaignSignaturesDetailed",
    "outputs": [
      {
        "components": [
          { "internalType": "address", "name": "signer", "type": "address" },
          { "internalType": "uint256", "name": "timestamp", "type": "uint256" },
          { "internalType": "string",  "name": "message", "type": "string" },
          { "internalType": "uint256", "name": "signatureVersionId", "type": "uint256" },
          { "internalType": "bytes32", "name": "signedArTxId", "type": "bytes32" },
          { "internalType": "bytes32", "name": "signedContentHash", "type": "bytes32" }
        ],
        "internalType": "struct PetitionCore.SignatureExport[]",
        "name": "items",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];
