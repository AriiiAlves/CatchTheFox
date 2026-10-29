---
title: "Introdução ao Buffer Overflow"
sidebar_position: 2
---

Buffer Overflow é a arte de **usar inputs para sobrescrever memória**. Todos os programas, em geral, esperam uma entrada para produzir uma resposta, certo?

Por exemplo:

```C
int main(){
    char nome[5];

    scanf("%s", nome);
    printf("Você digitou: %s", nome);
}
```
Acima, temos um array de caracteres que suporta 5 elementos: 4 caracteres e um `\0` (na memória, é apenas um 00) no final, que indica que é o fim da string.

Simples, não? O programa irá funcionar com o seu input:

```
< John
> Você digitou: John
```

Vamos dar um `disass main` no pwdgb:

```
0x0000555555555149 <+0>:     push   rbp
   0x000055555555514a <+1>:     mov    rbp,rsp
=> 0x000055555555514d <+4>:     sub    rsp,0x10
   0x0000555555555151 <+8>:     lea    rax,[rbp-0x5]
   0x0000555555555155 <+12>:    mov    rsi,rax
   ...
```

Esse é o início da função `main`. Note que é subtraído `0x10` do `rsp`, o que quer dizer que a stack terá 16 bytes (0x10 = 16) para variáveis.

Depois, a instrução `lea` carrega o endereço de `rbp-0x5` no `rax`. O `rax` é só uma variável temporária, que passa o seu valor para `rsi`, que por sua vez é o registrador utilizado como primeiro parâmetro de uma função. Isso tudo é o preparo para chamar a função `scanf`, que usa o endereço guardado no `rsi` para atribuir o input do usuário.

Opa! Nossa variável não tinha tamanho 5? Vemos um `rbp-0x5` aqui. Exatamente, as coisas são bem intuitivas. Acabamos de ver memória ser alocada na stack para receber uma string com 4 caracteres + byte nulo.

Se analisarmos no pwndbg, após darmos o input `John` temos na stack:

```
─────────────────────────────────────────────────────[ STACK ]──────────────────────────────────────────────────────
00:0000│ rsp 0x7fffffffdd40 ◂— 0
01:0008│-008 0x7fffffffdd48 ◂— 0x6e686f4affdde0
02:0010│ rbp 0x7fffffffdd50 ◂— 1
03:0018│+008 0x7fffffffdd58 —▸ 0x7ffff7ddfca8 (__libc_start_call_main+120) ◂— mov edi, eax
04:0020│+010 0x7fffffffdd60 —▸ 0x7fffffffde50 —▸ 0x7fffffffde58 ◂— 0x38 /* '8' */
05:0028│+018 0x7fffffffdd68 —▸ 0x555555555149 (main) ◂— push rbp
06:0030│+020 0x7fffffffdd70 ◂— 0x155554040
07:0038│+028 0x7fffffffdd78 —▸ 0x7fffffffde68 —▸ 0x7fffffffe148 ◂— '/mnt/c/Users/Ariel/Desktop/Manual-de-Engenharia-Reversa-Ganesh/test'
```

Vemos que só há um valor na stack entre o `rbp` e `rsp`. Se analisarmos esse valor:

```
0x6e686f4affdde0 = 
  6e 68 6f 4a ff dd e0
  n  h  o  J  [lixo de memória]
```

Na memória está sequencial, como veremos já já. Porém o GDB transforma isso em little endian (byte menos significativo primeiro), ou seja, inverte os bytes e mostra em um único hexadecimal.

O lixo de memória aparece justamente porque porque o GDB está mostrando o conteúdo bruto da memória no endereço que você examinou, não interpretando como string. Na verdade, ele está analisando 8 bytes de memória, que é o padrão. Porém, nossa variável ocupa apenas 5 bytes. Então sobram 3 bytes mesmo.

E dando `hexdump $rsp` para ver o binário da região da stack a partir do `rsp`, temos:

```
+0000 0x7fffffffdd40  00 00 00 00 00 00 00 00  e0 dd ff 4a 6f 68 6e 00  │........│...John.│
+0010 0x7fffffffdd50  01 00 00 00 00 00 00 00  a8 fc dd f7 ff 7f 00 00  │........│........│
+0020 0x7fffffffdd60  50 de ff ff ff 7f 00 00  49 51 55 55 55 55 00 00  │P.......│IQUUUU..│
+0030 0x7fffffffdd70  40 40 55 55 01 00 00 00  68 de ff ff ff 7f 00 00  │@@UU....│h.......│
```

Na memória, as coisas estão alinhadas. Note que temos 4a 6f 68 6e 00. O último caractere é o null terminator (indica fim da string).

Agora, vem uma questão. A variável suporta apenas 4 caracteres. O que ocorre se digitarmos 5?

```
< James
> Você digitou: James
```

Dando `hexdump $rsp`, temos:

```
 hexdump $rsp
+0000 0x7fffffffdd40  00 00 00 00 00 00 00 00  e0 dd ff 4a 61 6d 65 73  │........│...James│
+0010 0x7fffffffdd50  00 00 00 00 00 00 00 00  a8 fc dd f7 ff 7f 00 00  │........│........│
+0020 0x7fffffffdd60  50 de ff ff ff 7f 00 00  49 51 55 55 55 55 00 00  │P.......│IQUUUU..│
+0030 0x7fffffffdd70  40 40 55 55 01 00 00 00  68 de ff ff ff 7f 00 00  │@@UU....│h.......│
```

Veja, o `scanf` sobrescreveu a memória sem problemas. Mas agora o `\0` não está mais lá. Por sorte, os próximos bytes são `00`. Portanto, **o printf vai continuar lendo a string, mesmo que ela tenha passado o limite máximo, pois ele depende de encontrar o \0 ou 00 para terminar**. Isso é uma falha de segurança, pois permite vazar endereços de memória em um programa ao qual não temos acesso ao binário (cenas dos próximos capítulos).

E se decidirmos colocar uma string gigante?

```
< AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
> Você digitou: AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
```

Olhe só nossa stack agora:

```
─────────────────────────────────────────────────────[ STACK ]──────────────────────────────────────────────────────
00:0000│ rsp 0x7fffffffdd40 ◂— 0
01:0008│-008 0x7fffffffdd48 ◂— 0x4141414141ffdde0
02:0010│ rbp 0x7fffffffdd50 ◂— 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
... ↓        5 skipped
```

Perceba que o endereço de `rbp` foi sobrescrito com um monte de A's. E se dermos um `hexdump $rsp`:

```
hexdump $rsp

+0000 0x7fffffffdd40  00 00 00 00 00 00 00 00  e0 dd ff 41 41 41 41 41  │........│...AAAAA│
+0010 0x7fffffffdd50  41 41 41 41 41 41 41 41  41 41 41 41 41 41 41 41  │AAAAAAAA│AAAAAAAA│
... ↓            skipped 1 identical lines (16 bytes)
+0030 0x7fffffffdd70  41 41 41 41 41 41 41 41  41 41 41 41 41 41 41 41  │AAAAAAAA│AAAAAAAA│
```

Basicamente, acabamos de sobrescrever `0x7fffffffdd80 - 0x7fffffffdd4b = 0x35 = 53 (decimal)` Bytes (`0x7fffffffdd80` é o endereço do último byte com A. `0x7fffffffdd4b` é a quantidade de elementos que não são `41`)! E olha só, digitamos A 53 vezes.

Okay, isso significa que podemos **alterar o que quisermos na stack, desde a variável que permite o buffer overflow até depois do `rbp`**.

E o que acontece se tentarmos continuar o programa? Bom, não há outras variáveis no programa, então nada foi sobrescrito. Mas `rbp` e o `return address` (`rbp+0x8` em `x64`) foram sobrescritos. Quando a função `main` terminar, ela vai tentar voltar a algum endereço que estava guardado no `return address`, mas que se perdeu, pois sobrescrevemos ele com `0x4141414141414141`. Porém, ainda assim, esse endereço vai tentar ser acessado. No fim do código em assembly, vemos:

```
──────────────────────────────────────────────[ DISASM / x86-64 / set emulate on ]─────────────────────────────────
   0x55555555517a <main+49>    mov    rdi, rax               RDI => 0x555555556007 ◂— 0x696420aac3636f56
   0x55555555517d <main+52>    mov    eax, 0                 EAX => 0
   0x555555555182 <main+57>    call   printf@plt                  <printf@plt>

   0x555555555187 <main+62>    mov    eax, 0                 EAX => 0
   0x55555555518c <main+67>    leave
 ► 0x55555555518d <main+68>    ret                                <0x4141414141414141>
```

Viu que a instrução `ret` tem o endereço `0x4141414141414141`? Se prosseguirmos com a execução do programa....

```
pwndbg> c
Continuing.

Program received signal SIGSEGV, Segmentation fault.
```

**Segmentation fault**! Por que? Pois o endereço de memória `0x4141414141414141`, não deveria estar sendo acessado pelo programa, ou seja, é uma área de memória reservada de outro programa ou do sistema operacional.

O ponto principal do Buffer Overflow é que, **para um dado input, precisamos que o código leia mais caracteres do que a variável pode aguentar**. Se no código há um limite de caracteres, isso faz com que Buffer Overflow **não seja uma técnica possível**, e precisamos explorar outras possibiilidades.
