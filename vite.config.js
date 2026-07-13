import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import obfuscator from 'vite-plugin-javascript-obfuscator';

export default defineConfig({
  plugins: [
    react(),
    // 코드 난독화 — 빌드된 JS를 읽기 어렵게 변환.
    // 안정성을 위해 과도한 옵션(controlFlowFlattening 등)은 끔.
    obfuscator({
      // node_modules(React 등 라이브러리)는 난독화하지 않고 내 코드만 처리
      // (라이브러리까지 난독화하면 느려지고 깨질 위험이 커짐)
      include: [/src\/.*\.(js|jsx|ts|tsx)$/],
      exclude: [/node_modules/],
      apply: 'build', // 개발(dev) 중에는 끄고, 배포 빌드 때만 적용
      debugger: false,
      options: {
        compact: true,
        // 아래 두 개는 코드를 크게 뒤섞지만 성능 저하가 큼 → 안전하게 false
        controlFlowFlattening: false,
        deadCodeInjection: false,
        // 문자열을 배열로 빼서 숨김 (임상 템플릿 문구 등이 한눈에 안 보이게)
        stringArray: true,
        stringArrayThreshold: 0.75,
        stringArrayEncoding: ['base64'],
        // 변수·함수 이름을 의미 없는 형태로 변경
        identifierNamesGenerator: 'hexadecimal',
        // 디버깅 방해 옵션은 일부 브라우저에서 문제될 수 있어 끔
        debugProtection: false,
        disableConsoleOutput: false,
        selfDefending: false,
      },
    }),
  ],
  base: '/geomdan-guide/',
});
