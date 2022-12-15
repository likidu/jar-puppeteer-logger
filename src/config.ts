export type LoginRequest = {
  username: string
  password: string
  forum: Forum
}

export enum Forum {
  '4D4Y' = '4d4y',
  CHIPHELL = 'chiphell',
}

// Check is for checking that cookie is valid login cookie
export const ForumSettings = {
  '4D4Y': {
    name: Forum['4D4Y'],
    url: 'https://www.4d4y.com/forum/logging.php?action=login',
    check: 'cdb_auth',
  },
  CHIPHELL: {
    name: Forum.CHIPHELL,
    url: 'https://www.chiphell.com/member.php?mod=logging&action=login&mobile=2',
    check: 'v2x4_48dd_auth',
  },
}
