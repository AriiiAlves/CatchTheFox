---
title: "Introdução ao Buffer Overflow"
sidebar_position: 2
---

Buffer Overflow (BOF), consiste em escrever mais bytes em um buffer do que ele consegue comportar. Em C nada verifica esse limite: os bytes excedentes simplesmente sobrescrevem o que vem depois na memória. 

Quando o buffer é uma variável local (ou seja, fica na stack), o que vem depois é o resto do stack frame: outras variáveis, o `rbp` salvo e o endereço de retorno.

```c
int main(){
    char nome[5];

    scanf("%s", nome);          // lê sem limite de tamanho
    printf("Você digitou: %s", nome);
}
```

## O stack frame na memória

Vejamos o início da `main` do código dado anteriormente com `disass main`:

```nasm
push   rbp
mov    rbp,rsp
sub    rsp,0x10
lea    rax,[rbp-0x5]     ; endereço de nome
mov    rsi,rax           ; 2º argumento do scanf
```

A instrução `sub rsp, 0x10` reserva 16 bytes para variáveis locais, e `nome` começa em `rbp-0x5`. O frame fica assim:

<Mem
  title="Stack frame da main. O scanf escreve a partir de rbp-0x5, em direção aos endereços altos"
  top="endereços baixos"
  bottom="endereços altos"
  rows={[
    {addr: 'rbp-0x10', label: '(não usado)', kind: 'neutral', h: 1.4, note: 'rsp'},
    {addr: 'rbp-0x5', label: 'nome[5]', kind: 'data', note: 'início do input'},
    {addr: 'rbp', label: 'rbp salvo', kind: 'meta', note: '5 bytes depois do início'},
    {addr: 'rbp+0x8', label: 'return address', kind: 'danger', note: '13 bytes depois do início'},
    {addr: 'rbp+0x10', label: 'frame de quem chamou a main', kind: 'neutral'},
  ]}
/>

Com o input `John`, cabe tudo no buffer (`hexdump $rsp` no pwndbg):

```
+0000 0x7fffffffdd40  00 00 00 00 00 00 00 00  e0 dd ff 4a 6f 68 6e 00  │........│...John.│
+0010 0x7fffffffdd50  01 00 00 00 00 00 00 00  a8 fc dd f7 ff 7f 00 00  │........│........│
```

Vemos que `4a 6f 68 6e 00` é `John\0`, terminando exatamente no último byte antes de `rbp` (`0x7fffffffdd50`). Na linha seguinte estão o `rbp` salvo (`1`) e o endereço de retorno (`0x7ffff7ddfca8`, dentro da libc).

:::note Lendo a stack no pwndbg
A seção `STACK` mostra a memória em palavras (words) de 8 bytes, já interpretadas como inteiros little endian. A palavra em `0x7fffffffdd48` aparece como sendo `0x6e686f4affdde0`: os bytes `e0 dd ff` são lixo que já estava lá, seguidos de `4a 6f 68 6e` (`John`) e do `00`. Para ver byte a byte, na ordem da memória, use `hexdump`.
:::

## Estourando o Buffer

Com `James` (5 letras), o `\0` do final já cai fora da variável, em cima do primeiro byte do `rbp` salvo:

```
+0000 0x7fffffffdd40  00 00 00 00 00 00 00 00  e0 dd ff 4a 61 6d 65 73  │........│...James│
+0010 0x7fffffffdd50  00 00 00 00 00 00 00 00  a8 fc dd f7 ff 7f 00 00  │........│........│
```

Com 53 letras `A`:

```
+0000 0x7fffffffdd40  00 00 00 00 00 00 00 00  e0 dd ff 41 41 41 41 41  │........│...AAAAA│
+0010 0x7fffffffdd50  41 41 41 41 41 41 41 41  41 41 41 41 41 41 41 41  │AAAAAAAA│AAAAAAAA│
... ↓            skipped 1 identical lines (16 bytes)
+0030 0x7fffffffdd70  41 41 41 41 41 41 41 41  41 41 41 41 41 41 41 41  │AAAAAAAA│AAAAAAAA│
```

Repare que o `rbp` salvo e endereço de retorno foram sobrescritos. Quando a `main` executa o `ret`, ele tenta pular para o endereço de retorno sobrescrito:

```
 ► 0x55555555518d <main+68>    ret                                <0x4141414141414141>

Program received signal SIGSEGV, Segmentation fault.
```

`0x4141414141414141` não é um endereço mapeado (em x86-64 nem é canônico: endereços de usuário vão até `0x00007fffffffffff`), então o processo morre com `SIGSEGV`. O crash em si não interessa. O que interessa é que **o valor que foi para o `rip` saiu do nosso input**. Trocando os `A` certos por um endereço válido, escolhemos para onde o programa vai.

## O que é possível fazer com Buffer Overflow 

Vimos que Buffer Overflow consiste em sobrescrever a Stack. E o que podemos fazer com isso? 

| Alvo | Resultado | Página |
|---|---|---|
| Variáveis locais depois do buffer | Mudar o comportamento do programa (flags, tamanhos, ponteiros) | [BOF - Variáveis](./variables.md) |
| Endereço de retorno | Pular para uma função existente | [BOF - Return Address](./return-address.md) |
| Endereço de retorno, com stack executável | Executar código injetado | [BOF - Shellcode](./shellcode.md) |
| Endereço de retorno e o que vem depois | Encadear trechos de código existentes | [ROP](../rop/index.mdx) |

O que atrapalha: 

- [Stack Canary](../../protections.mdx#stack-canaryssp-stack-smashing-protector) (detecta a sobrescrita do endereço de retorno)
- PIE/ASLR (você precisa saber para onde pular) e NX (não dá para executar a stack).

## Onde ocorre a vulnerabilidade

O overflow existe quando a **função de leitura ou cópia aceita mais bytes do que o destino comporta**:

| Função | Problema |
|---|---|
| `gets(buf)` | Sem limite nenhum. Para só no `\n` |
| `scanf("%s", buf)` | Sem limite. Para em espaço, tab ou `\n` |
| `strcpy`, `strcat`, `sprintf` | Copiam até o `\0` da origem |
| `read(0, buf, n)`, `fgets(buf, n, f)`, `memcpy(dst, src, n)` | Vulneráveis quando `n > buffer` |
| Laços manuais (`while ((c = getchar()) != '\n') buf[i++] = c;`) | Sem checagem de `i` |

Guarde também **quais bytes cada função aceita**, porque isso limita o payload: 

- `gets` e `read` aceitam bytes nulos (endereços de 64 bits passam inteiros)
- `strcpy` para no primeiro `\0`
- `scanf("%s")` para em espaços (`0x20`, `0x09` a `0x0d`).

Se o tamanho lido respeita o buffer (`fgets(buf, sizeof(buf), stdin)`), não há como fazer Buffer Overflow.
