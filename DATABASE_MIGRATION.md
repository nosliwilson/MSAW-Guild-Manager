# Migração de Banco de Dados (Prisma ORM)

O sistema foi totalmente refatorado para suportar múltiplos bancos de dados (MySQL, PostgreSQL, SQL Server) utilizando o **Prisma ORM**.
Isso significa que o código do sistema não depende mais de SQL puro específico do SQLite e toda a comunicação com o banco de dados é feita através do Prisma Client.

## Como migrar para um novo banco de dados (ex: MySQL ou PostgreSQL)

Quando você for hospedar o sistema em sua própria infraestrutura e quiser utilizar um banco de dados mais robusto, siga estes passos:

### 1. Atualize o arquivo `prisma/schema.prisma`

Abra o arquivo `prisma/schema.prisma` e altere o `provider` e a `url` no bloco `datasource db`:

**Para MySQL:**
```prisma
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}
```

**Para PostgreSQL:**
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### 2. Configure a variável de ambiente

Crie um arquivo `.env` na raiz do projeto (ou configure nas variáveis de ambiente do seu servidor) com a URL de conexão do seu novo banco de dados:

**Exemplo MySQL:**
```env
DATABASE_URL="mysql://usuario:senha@localhost:3306/nome_do_banco"
```

**Exemplo PostgreSQL:**
```env
DATABASE_URL="postgresql://usuario:senha@localhost:5432/nome_do_banco?schema=public"
```

### 3. Gere as tabelas no novo banco

Com o banco de dados rodando e a URL configurada, execute o seguinte comando no terminal para que o Prisma crie todas as tabelas automaticamente:

```bash
npx prisma db push
```
*(Nota: Para ambientes de produção contínuos, recomenda-se usar `npx prisma migrate dev` e `npx prisma migrate deploy` para manter um histórico de migrações).*

### 4. Gere o Prisma Client

Após criar as tabelas, gere o cliente do Prisma para que o código TypeScript reconheça o novo banco:

```bash
npx prisma generate
```

### 5. Inicie o servidor

Agora você pode iniciar o servidor normalmente:

```bash
npm run dev
# ou para produção:
npm start
```

---

## O que foi feito?

1. **Prisma Instalado:** O Prisma ORM e o `@prisma/client` foram adicionados ao projeto.
2. **Esquema Criado:** O arquivo `prisma/schema.prisma` foi criado mapeando exatamente a estrutura atual do banco.
3. **Refatoração Completa:** Todas as chamadas diretas ao banco de dados utilizando `better-sqlite3` foram substituídas por chamadas do Prisma Client (`prisma.user.findMany()`, `prisma.member.create()`, etc.). A biblioteca `better-sqlite3` foi removida do projeto.
4. **Gerenciamento de Banco:** As funções de backup e restauração foram atualizadas para funcionar com a nova estrutura, e a visualização de tabelas no painel de administração agora utiliza as consultas raw do Prisma.
