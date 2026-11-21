import { Story, StoryGroup, StoryViewerEntry } from '../../types';

export interface CreateStoryDTO {
  mediaUrl: string;
  mediaType: 'image';
  caption?: string;
}

export interface IStoriesService {
  getStoryGroups(): Promise<StoryGroup[]>;
  getStoriesByUser(userId: string): Promise<Story[]>;
  createStory(dto: CreateStoryDTO): Promise<Story>;
  viewStory(storyId: string): Promise<void>;
  deleteStory(storyId: string): Promise<boolean>;
  /** Viewers of one of the current user's own stories, newest first. */
  getStoryViewers(storyId: string): Promise<StoryViewerEntry[]>;
}
