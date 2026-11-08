import { useEffect, useRef, useState } from 'react';
import { TodoList } from '../components/TodoList';
import { useEncryptedStorage } from '../hooks/useEncryptedStorage';
import '../styles/form.css';
import '../styles/pages/todo.css';

const LOAD_FAILED = "Couldn't open your tasks. Lock and unlock Crewbook to try again.";

/** Task titles and descriptions can be about performance, so they wait for the private envelope. */
export function Todos() {
  const { isPrivateUnlocked, loadPrivate } = useEncryptedStorage();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    let isCurrent = true;
    loadPrivate().catch(() => {
      if (isCurrent) setLoadFailed(true);
    });
    return () => {
      isCurrent = false;
    };
  }, [loadPrivate]);

  return (
    <>
      <h1 ref={headingRef} tabIndex={-1} className="todo-page__title">
        My Tasks
      </h1>
      {loadFailed ? (
        <p className="form-error" role="alert">
          {LOAD_FAILED}
        </p>
      ) : isPrivateUnlocked ? (
        <TodoList />
      ) : (
        <p className="todo-page__loading">Opening your tasks…</p>
      )}
    </>
  );
}
