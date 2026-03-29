import { writeFileSync } from 'fs';

// Small: ~100 lines
let small = '# Small Document\n\nHello world.\n\n## Section\n\nSome text here.\n\n```js\nconst x = 1;\nconsole.log(x);\n```\n\nAnother paragraph.\n';
writeFileSync('small.md', small);

// Medium: ~500 lines
let medium = '# Medium Document\n\n';
for (let i = 0; i < 20; i++) {
  medium += `## Section ${i}\n\n`;
  medium += `This is paragraph ${i} with some text.\n\n`;
  medium += '| Column A | Column B | Column C |\n';
  medium += '|----------|----------|----------|\n';
  for (let j = 0; j < 5; j++) {
    medium += `| Cell ${i}-${j}A | Cell ${i}-${j}B | Cell ${i}-${j}C |\n`;
  }
  medium += '\n```python\n';
  medium += `def example_${i}():\n`;
  medium += `    return ${i} * 2\n`;
  medium += '```\n\n';
}
writeFileSync('medium.md', medium);

// Large: ~2000 lines
let large = '# Large Document\n\n';
for (let i = 0; i < 80; i++) {
  large += `## Heading ${i}\n\n`;
  large += `Content for section ${i}. This is some descriptive text.\n\n`;
  if (i % 3 === 0) {
    large += '| H1 | H2 | H3 |\n|--------|--------|--------|\n';
    for (let j = 0; j < 8; j++) {
      large += `| R${j}C1 | R${j}C2 | R${j}C3 |\n`;
    }
    large += '\n';
  }
  if (i % 4 === 0) {
    large += '```javascript\n';
    large += `function test${i}(x) {\n`;
    large += `  return x + ${i};\n`;
    large += '}\n';
    for (let k = 0; k < 5; k++) {
      large += `const val${k} = test${i}(${k});\n`;
    }
    large += '```\n\n';
  }
}
writeFileSync('large.md', large);

// Huge: ~5000 lines
let huge = '# Huge Document\n\n';
for (let i = 0; i < 200; i++) {
  huge += `## Chapter ${i}\n\n`;
  huge += `This is chapter ${i} content. Lorem ipsum dolor sit amet.\n\n`;
  if (i % 2 === 0) {
    huge += '| A | B | C | D |\n';
    huge += '|---|---|---|---|\n';
    for (let r = 0; r < 10; r++) {
      huge += `| ${i}-${r}A | ${i}-${r}B | ${i}-${r}C | ${i}-${r}D |\n`;
    }
    huge += '\n';
  }
  if (i % 5 === 0) {
    huge += '```go\n';
    huge += `package main\n\n`;
    huge += `func main() {\n`;
    huge += `    for i := 0; i < ${i}; i++ {\n`;
    huge += `        println(i)\n`;
    huge += `    }\n`;
    huge += '}\n';
    huge += '```\n\n';
  }
  if (i % 3 === 0) {
    huge += `> Blockquote ${i}: Some important note here.\n\n`;
  }
}
writeFileSync('huge.md', huge);

console.log('Generated benchmark files');
