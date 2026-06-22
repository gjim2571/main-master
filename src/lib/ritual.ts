// Ritual Testnet Configuration
export const RITUAL_TESTNET = {
  chainId: '0x45d', // 1117 in hex
  chainName: 'Ritual Testnet',
  nativeCurrency: {
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: ['https://rpc.ritual.gobob.xyz/'],
  blockExplorerUrls: ['https://explorer.ritual.gobob.xyz/'],
};

// Simple score contract ABI (simulated - ready for deployment)
export const SCORE_CONTRACT_ABI = [
  'function submitScore(uint256 score) external',
  'function getScore(address player) external view returns (uint256)',
  'function getTopScores(uint256 limit) external view returns (address[] memory, uint256[] memory)',
  'function playerCount() external view returns (uint256)',
  'event ScoreSubmitted(address indexed player, uint256 score, uint256 timestamp)',
];

// Contract address placeholder (to be deployed)
export const SCORE_CONTRACT_ADDRESS = '0x0000000000000000000000000000000000000000';
