import { accountInitials, type LocalAccount } from './webAuth';

interface AccountAvatarProps {
  account: LocalAccount;
  className: string;
}

export function AccountAvatar({ account, className }: AccountAvatarProps) {
  return (
    <span
      className={`${className}${account.avatar ? ' has-avatar' : ''}`}
      style={{ background: account.color }}
      aria-hidden="true"
    >
      {account.avatar ? <img src={account.avatar} alt="" decoding="async" /> : accountInitials(account.name)}
    </span>
  );
}
