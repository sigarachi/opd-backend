import { Request, Response, NextFunction } from 'express';
import { RequestSerice } from '../services/request.service';
import { CreateProjectRequest, GenerateTokenProps } from '../types';
import { ProjectService } from '../services/project.service';
import ApiStatus from '../handlers/api.handler';
import { GroupService } from '../services/group.service';
import UserService from '../services/user.service';

export class RequestController {
	static async getUserRequests(
		req: Request,
		res: Response,
		next: NextFunction
	) {
		try {
			const { id } = req.params;

			const requests = await RequestSerice.getUserRequests(id);

			return res.status(200).json({
				...requests,
			});
		} catch (e) {
			next(e);
		}
	}

	static async getProjectRequests(
		req: Request,
		res: Response,
		next: NextFunction
	) {
		try {
			//@ts-ignore
			const user = req.user as GenerateTokenProps;

			const { id } = req.params;

			const project = await ProjectService.getProject(id);

			if (!project) {
				throw ApiStatus.pageNotFound('Проект не найден');
			}

			if (project.managerId !== user.id) {
				throw ApiStatus.forbidden('Вы не можете получить список заявок');
			}

			const requests = await RequestSerice.getProjectRequests(id);

			return res.status(200).json({
				requests,
			});
		} catch (e) {
			next(e);
		}
	}

	static async updateRequestsPriority(
		req: Request<
			never,
			never,
			{ forUpdate: Array<{ id: string; priority: number }> }
		>,
		res: Response,
		next: NextFunction
	) {
		try {
			//@ts-ignore
			const user = req.user as GenerateTokenProps;

			const { forUpdate } = req.body;

			const requests = await RequestSerice.setPriority(forUpdate);

			return res.status(200).json({
				...requests,
			});
		} catch (e) {
			next(e);
		}
	}

	static async createRequest(
		req: Request<never, never, Pick<CreateProjectRequest, 'priority'>>,
		res: Response,
		next: NextFunction
	) {
		try {
			//@ts-ignore
			const user = req.user as GenerateTokenProps;

			const { projectId } = req.params;

			const createdRequests = await RequestSerice.getUserRequests(user.id);

			if (createdRequests?.requests && createdRequests.requests.length >= 5) {
				throw ApiStatus.badRequest('Превышен лимит заявок на проекты');
			}

			let hasAnotherApprovedRequests = false;

			if (createdRequests?.requests) {
				hasAnotherApprovedRequests =
					createdRequests.requests[0]?.hasAnotherApprovedRequests ?? false;
			}

			const requests = await RequestSerice.createRequest({
				userId: user.id,
				priority:
					(createdRequests?.requests && createdRequests?.requests.length + 1) ??
					1,
				projectId: projectId,
				hasAnotherApprovedRequests: hasAnotherApprovedRequests,
			});

			return res.status(200).json({
				...requests,
			});
		} catch (e) {
			next(e);
		}
	}

	static async cancelRequest(req: Request, res: Response, next: NextFunction) {
		try {
			const { id } = req.params;

			const request = await RequestSerice.updateRequest(id, 'rejected');

			return res.status(200).json({
				...request,
			});
		} catch (e) {
			next(e);
		}
	}

	static async approveRequest(req: Request, res: Response, next: NextFunction) {
		try {
			//@ts-ignore
			const user = req.user as GenerateTokenProps;

			const { id } = req.params;

			const request = await RequestSerice.getRequest(id);

			if (!request) throw ApiStatus.badRequest('Запрос не найден');

			if (request.hasAnotherApprovedRequests)
				throw ApiStatus.badRequest('Пользователь уже состоит в другом проекте');

			const project = await ProjectService.getProject(request.projectId);
			const requestUserGroup = await UserService.getUserInfo(request.userId);

			if (!project) throw ApiStatus.badRequest('Проект не найден');

			if (project.managerId !== user.id)
				throw ApiStatus.forbidden('Вы не можете этого сделать');

			if (project.team.length + 1 > project.maxUserNum)
				throw ApiStatus.badRequest(
					'Достигнуто максимальное количество участников'
				);

			if (project.teamYear === '') {
				await ProjectService.updateProject({
					id: project.id,
					teamYear: requestUserGroup.group.enteringYear,
				});
			}

			if (
				project.teamYear !== '' &&
				project.teamYear !== requestUserGroup.group.enteringYear
			)
				throw ApiStatus.badRequest(
					'Команда может состоять только из одного курса обучения'
				);

			await RequestSerice.updateRequest(id, 'confirmed');
			await ProjectService.addTeamMember(request.userId, request.projectId);

			await RequestSerice.updateAnotherUsersRequests(request.userId);

			return res.status(200).json({
				...request,
			});
		} catch (e) {
			next(e);
		}
	}
}
