import fs from 'fs';
import path from 'path';

const artifactPath = path.join(__dirname, '../../foundry/out/Superbles.sol/Superbles.json');
const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

const output = `
export const SUPERCHAIN_BYTECODE = "${artifact.bytecode}" as const;
`;

fs.writeFileSync(
  path.join(__dirname, '../constants/bytecode.ts'), 
  output
); 