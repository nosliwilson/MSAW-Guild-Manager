# Sistema de Gestão de Guilda

Este repositório contém um sistema completo de gestão para guildas, incluindo importação de logs, controle de personagens e monitoramento de segurança.

## 🚀 Como Rodar Localmente (Docker)

A maneira mais fácil de subir o sistema é utilizando Docker. Certifique-se de ter o Docker e o Docker Compose instalados.

1.  **Clone o repositório:**
    ```bash
    git clone <url-do-repositorio>
    cd <nome-do-diretorio>
    ```

2.  **Suba o container:**
    ```bash
    docker compose up -d --build
    ```

3.  **Acesse o sistema:**
    O sistema estará disponível em [http://localhost:3000](http://localhost:3000)

### Configurações de Banco de Dados
O sistema utiliza SQLite por padrão. O arquivo de banco de dados (`guild.db`) é persistido através de um volume Docker para que seus dados não sejam perdidos ao reiniciar o container.

## 🛠️ Desenvolvimento

Se preferir rodar sem Docker:

1.  Instale as dependências:
    ```bash
    npm install
    ```

2.  Sincronize o banco de dados:
    ```bash
    npx prisma db push
    ```

3.  Inicie em modo de desenvolvimento:
    ```bash
    npm run dev
    ```

## 🛡️ Segurança e Monitoramento

O sistema possui logs de segurança automáticos salvos no banco de dados e impressos no console no formato padrão para o **fail2ban**.

Para visualizar os logs:
- Acesse as **Configurações** no sistema logado como administrador.
- Vá para a aba **Logs de Segurança**.

Os logs incluem tentativas de login falhas, acessos a arquivos inexistentes (scans de bots) e tentativas de SQL Injection.
