/**
 * Sistema de monitoramento de saúde do worker
 */

const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

/**
 * Verifica se o LibreOffice está instalado e funcionando
 * @returns {Promise<{installed: boolean, version: string|null}>}
 */
async function verificarLibreOffice() {
  try {
    const { stdout } = await execAsync('libreoffice --version');
    const version = stdout.trim();
    return {
      installed: true,
      version: version,
    };
  } catch (error) {
    return {
      installed: false,
      version: null,
    };
  }
}

/**
 * Verifica o espaço em disco disponível
 * @returns {Promise<{available: string, percentage: number}>}
 */
async function verificarEspacoDisco() {
  try {
    const { stdout } = await execAsync('df -h /tmp | tail -1');
    const parts = stdout.trim().split(/\s+/);
    
    return {
      available: parts[3], // Espaço disponível
      percentage: parseInt(parts[4]), // Percentual usado
    };
  } catch (error) {
    return {
      available: 'unknown',
      percentage: 0,
    };
  }
}

/**
 * Verifica o uso de memória
 * @returns {Promise<{total: string, used: string, free: string}>}
 */
async function verificarMemoria() {
  try {
    const { stdout } = await execAsync('free -h | grep Mem');
    const parts = stdout.trim().split(/\s+/);
    
    return {
      total: parts[1],
      used: parts[2],
      free: parts[3],
    };
  } catch (error) {
    return {
      total: 'unknown',
      used: 'unknown',
      free: 'unknown',
    };
  }
}

/**
 * Retorna o status geral de saúde do worker
 * @returns {Promise<Object>}
 */
async function obterStatusSaude() {
  const [libreoffice, disco, memoria] = await Promise.all([
    verificarLibreOffice(),
    verificarEspacoDisco(),
    verificarMemoria(),
  ]);

  const healthy = libreoffice.installed && disco.percentage < 90;

  return {
    status: healthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    libreoffice,
    disco,
    memoria,
    node: {
      version: process.version,
      platform: process.platform,
      arch: process.arch,
    },
  };
}

module.exports = {
  verificarLibreOffice,
  verificarEspacoDisco,
  verificarMemoria,
  obterStatusSaude,
};
