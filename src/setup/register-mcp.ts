import { readFileSync, writeFileSync, existsSync } from 'fs';

interface McpServerConfig {
  command: string;
  args: string[];
}

interface McpConfig {
  mcpServers: Record<string, McpServerConfig>;
}

export function registerMcp(mcpJsonPath: string): void {
  let config: McpConfig;

  if (existsSync(mcpJsonPath)) {
    const content = readFileSync(mcpJsonPath, 'utf-8');
    config = JSON.parse(content);
  } else {
    config = { mcpServers: {} };
  }

  // Ensure mcpServers object exists
  if (!config.mcpServers) {
    config.mcpServers = {};
  }

  // Add brand-voice entry
  config.mcpServers['brand-voice'] = {
    command: 'npx',
    args: ['brand-voice-mcp'],
  };

  writeFileSync(mcpJsonPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

export function unregisterMcp(mcpJsonPath: string): void {
  if (!existsSync(mcpJsonPath)) {
    return;
  }

  const content = readFileSync(mcpJsonPath, 'utf-8');
  const config: McpConfig = JSON.parse(content);

  // Ensure mcpServers object exists
  if (!config.mcpServers) {
    config.mcpServers = {};
  }

  // Remove brand-voice entry
  delete config.mcpServers['brand-voice'];

  writeFileSync(mcpJsonPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}
