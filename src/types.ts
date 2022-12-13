export enum Forum {
  '4D4Y' = '4d4y',
  CHIPHELL = 'chiphell',
}

export enum ForumUrl {
  '4D4Y' = 'https://www.4d4y.com/forum/logging.php?action=login',
  CHIPHELL = 'https://www.chiphell.com/member.php?mod=logging&action=login&mobile=2',
}

export type LoginRequest = {
  username: string
  password: string
  forum: Forum
}
