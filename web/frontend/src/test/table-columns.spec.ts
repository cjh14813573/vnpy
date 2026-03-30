import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 检查 Table columns 配置是否有重复的 dataIndex
 * 防止 React key 重复错误
 */
describe('Table Columns Configuration', () => {
  const pagesDir = path.join(__dirname, '../pages');
  const pageFiles = fs.readdirSync(pagesDir).filter(f => f.endsWith('.tsx'));

  pageFiles.forEach(file => {
    it(`${file} should not have duplicate dataIndex within the same table`, () => {
      const content = fs.readFileSync(path.join(pagesDir, file), 'utf-8');

      // 查找 Table 组件的 columns 属性（简化检查：查找 columns={...} 内的 dataIndex）
      // 使用正则匹配 dataIndex: 'xxx' 或 dataIndex: "xxx"
      const tableRegex = /<Table[\s\S]*?columns=\{([^}]+)\}[\s\S]*?\/>/g;

      // 更简单的策略：按变量定义分割检查
      // 查找 const xxxColumns = [...] 定义
      const columnsVarRegex = /const\s+(\w+Columns)\s*=\s*\[([\s\S]*?)\];/g;

      let columnsMatch;
      while ((columnsMatch = columnsVarRegex.exec(content)) !== null) {
        const columnsName = columnsMatch[1];
        const columnsContent = columnsMatch[2];

        // 提取该 columns 定义内的所有 dataIndex
        const dataIndexRegex = /dataIndex:\s*['"]([^'"]+)['"]/g;
        const dataIndices: string[] = [];
        let match;

        while ((match = dataIndexRegex.exec(columnsContent)) !== null) {
          dataIndices.push(match[1]);
        }

        // 检查是否有重复（在同一 columns 定义内）
        const validDataIndices = dataIndices.filter(d => d && d !== 'undefined');
        const uniqueDataIndices = new Set(validDataIndices);

        // 如果有重复，给出详细信息
        if (validDataIndices.length !== uniqueDataIndices.size) {
          const counts = validDataIndices.reduce((acc, curr) => {
            acc[curr] = (acc[curr] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);

          const duplicates = Object.entries(counts)
            .filter(([_, count]) => count > 1)
            .map(([key, count]) => `${key} (${count} times)`);

          expect.fail(`Duplicate dataIndex found in ${columnsName}: ${duplicates.join(', ')}`);
        }
      }

      // 如果没有找到 columns 变量定义，测试通过
      expect(true).toBe(true);
    });
  });
});
