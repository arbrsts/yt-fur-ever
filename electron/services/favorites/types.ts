export interface Favorite {
  id: number;
  url: string;
  title: string;
}

export type AddFavoriteParams = string;

export type RemoveFavoriteParams = number;
