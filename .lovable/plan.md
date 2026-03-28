

## Correção: Erro de TypeScript no PanicButton.tsx

### Problema
O arquivo `src/components/autotrade/PanicButton.tsx` linha 21 acessa `result?.closed` mas o retorno de `panicCloseAll()` é tipado como `unknown`, causando erro TS2339.

### Correção
Na linha 21, fazer cast seguro do resultado:

```typescript
const res = result as { closed?: number } | undefined;
toast.success(`Todas as posições encerradas! ${res?.closed || 0} posição(ões) fechada(s).`);
```

### Escopo
- Apenas 1 linha alterada em 1 arquivo
- Zero impacto em outras funcionalidades

