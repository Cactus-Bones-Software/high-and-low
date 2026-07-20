# Design Decisions

This document outlines the key design decisions made for the project.

## Key Decisions

1. **Database Schema**: 
   - The database uses IndexedDB with three object stores: `config`, `logs`, and `questions`.
   - Each object store has a unique key path: `key` for `config`, `timestamp` for `logs`, and `id` for `questions`.

2. **Question Management**:
   - Questions are stored in the `questions` object store with a unique `id`.
   - The `id` is generated using a custom function `makeCustomId` which ensures uniqueness based on the question text.

3. **User Interface**:
   - The user interface is designed to be responsive and accessible.
   - The theme and contrast settings are configurable and stored in the `config` object store.

4. **Session Management**:
   - User sessions are tracked and logged in the `logs` object store.
   - Each log entry includes the timestamp, answers, and any notes added by the user.

5. **Error Handling**:
   - Promises are used extensively to handle asynchronous operations.
   - Errors are logged and handled gracefully to ensure the application remains responsive.

## Rationale

- **Database Schema**: Using IndexedDB allows for efficient storage and retrieval of data, which is crucial for a responsive application.
- **Question Management**: Ensuring unique question IDs helps prevent data conflicts and simplifies data management.
- **User Interface**: Configurable themes and contrast settings improve accessibility and user experience.
- **Session Management**: Detailed logging of user sessions helps in analyzing user behavior and improving the application.
- **Error Handling**: Graceful error handling ensures a smooth user experience and aids in debugging.

