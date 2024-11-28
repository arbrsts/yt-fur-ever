export interface Favorite {
  id: number;
  display_id: string;
  title: string;
}

export type AddFavoriteParams = string;

export type RemoveFavoriteParams = number;
