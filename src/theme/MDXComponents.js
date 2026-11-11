// Componentes disponíveis em todos os .md/.mdx sem precisar de import.
import MDXComponents from '@theme-original/MDXComponents';
import {Mem, Chain, Flow, Side} from '@site/src/components/diagrams';

export default {
  ...MDXComponents,
  Mem,
  Chain,
  Flow,
  Side,
};
