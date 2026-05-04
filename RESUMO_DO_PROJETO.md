# Resumo do Projeto: Sistema de Gestão de OS

## Visão Geral
Este projeto é um **Sistema de Gestão de Ordens de Serviço (OS)**, focado no controle de manutenções e serviços prestados a clientes. Pela estrutura de dados e dependências, parece ser ideal para assistências técnicas (como relojoarias, mencionado no banco de dados), permitindo o acompanhamento do status do serviço, registro fotográfico do produto e controle financeiro (sinais e saldos).

## Stack Tecnológica (Tech Stack)
A aplicação é um projeto *fullstack* moderno que utiliza:

*   **Frontend:** React 19 com TypeScript, construído através do Vite.
*   **Estilização e UI:** Tailwind CSS v4, animações com `motion` e ícones do `lucide-react`.
*   **Backend:** Node.js com Express para a API/servidor local, executado com `tsx` no ambiente de desenvolvimento.
*   **Banco de Dados:** PostgreSQL (utilizando o pacote `pg`).
*   **Funcionalidades Específicas:**
    *   Captura de imagens (fotos do produto) via `react-webcam`.
    *   Integração com IA utilizando `@google/genai`.
    *   Autenticação via JSON Web Tokens (`jsonwebtoken`).

## Estrutura do Banco de Dados (Modelagem)
A persistência de dados está estruturada da seguinte forma:

1.  **Usuários (`users`):** Operadores do sistema com níveis de acesso (Admin/Operador).
2.  **Clientes (`customers`):** Cadastro de clientes (Consumidor Final ou Relojoaria), com controle de autorização para contato via WhatsApp.
3.  **Ordens de Serviço (`service_orders`):** A entidade principal. Armazena:
    *   Dados do produto e serviço solicitado.
    *   Técnico responsável e vendedor.
    *   Valores do serviço, sinais (depósitos) e saldo devedor.
    *   URLs para fotos do produto (frente e verso).
    *   Prazos e status atual.
4.  **Histórico de OS (`os_history`):** Tabela de auditoria para rastrear mudanças de status e quem as realizou.
5.  **Apoio (`technicians`, `sellers`, `system_settings`):** Cadastros básicos de técnicos, vendedores e configurações do sistema.

## Scripts Disponíveis (`package.json`)
*   `npm run dev`: Inicia o servidor local de desenvolvimento executando o arquivo `server.ts`.
*   `npm run build`: Compila a aplicação frontend com Vite.
*   `npm run preview`: Visualiza o build de produção localmente.
*   `npm run clean`: Limpa o diretório de build (`dist`).
*   `npm run lint`: Checa erros de tipagem com o TypeScript.
