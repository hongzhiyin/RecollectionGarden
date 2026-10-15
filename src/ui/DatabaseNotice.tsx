import { useEffect, useState } from 'react';
import { library } from '../library/repository';

export function DatabaseNotice() {
  const [message, setMessage] = useState('');
  useEffect(() => {
    const blocked = () => setMessage('数据库升级正在等待旧窗口，请刷新或关闭其他阅读窗口。升级完成后才能保存笔记。');
    const changed = () => setMessage('数据库已升级，请刷新此窗口后继续使用。');
    const ready = () => setMessage('');
    library.database.on('blocked', blocked); library.database.on('versionchange', changed); library.database.on('ready', ready);
    return () => { library.database.on('blocked').unsubscribe(blocked); library.database.on('versionchange').unsubscribe(changed);
      library.database.on('ready').unsubscribe(ready); };
  }, []);
  return message ? <p className="database-notice" role="alert">{message}</p> : null;
}
