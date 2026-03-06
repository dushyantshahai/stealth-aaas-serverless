import { EnvironmentConfig } from './types';
import { devConfig } from './dev';
import { stagingConfig } from './staging';
import { prodConfig } from './prod';

export function getConfig(stage?: string): EnvironmentConfig {
  const env = stage || process.env.STAGE || 'dev';
  
  switch (env) {
    case 'dev':
      return devConfig;
    case 'staging':
      return stagingConfig;
    case 'prod':
      return prodConfig;
    default:
      console.warn(`Unknown stage: ${env}, defaulting to dev`);
      return devConfig;
  }
}

export { EnvironmentConfig } from './types';
export { devConfig, stagingConfig, prodConfig };
